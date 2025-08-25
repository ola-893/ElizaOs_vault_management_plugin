import { 
  Plugin, 
  Action, 
  Provider, 
  Memory, 
  State, 
  IAgentRuntime,
  ActionExample,
  HandlerCallback,
  elizaLogger,
  ActionResult,
  ProviderResult,
  Handler
} from "@elizaos/core";
import axios, { AxiosResponse } from "axios";
import { WalletAnalyzer } from './wallet-analyzer.ts';
import { walletAnalysisActions } from "./analyzeWalletAction.ts";
import { checkWalletBalances, executeStakingAction, executeStakingTransaction, selectStakingAction } from "./goatActions.ts";


// TYPES
interface StakingOpportunity {
  readonly protocol: string;
  readonly asset: string;
  readonly apy: number;
  readonly tvl: number;
  readonly riskLevel: RiskLevel;
  readonly lockPeriod: number;
  readonly minDeposit: number;
  readonly category: StakingCategory;
  readonly contractAddress: string;
  readonly description: string;
  readonly lastUpdated: Date;
  readonly personalizedScore?: number;
  readonly compatibilityReason?: string;
}

type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type RiskTolerance = "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
type StakingCategory = "LIQUID_STAKING" | "LENDING" | "YIELD_FARMING" | "RESTAKING";

interface WalletAnalysis {
  readonly address: string;
  readonly totalBalance: string;
  readonly portfolioValue: string;
  readonly transactionCount: number;
  readonly riskProfile: WalletRiskProfile;
  readonly behaviorPatterns: BehaviorPattern[];
}

interface WalletRiskProfile {
  readonly riskScore: number;
  readonly riskTolerance: RiskTolerance;
  readonly maxSinglePosition: string;
  readonly lockPeriodTolerance: number;
}

interface BehaviorPattern {
  readonly pattern: string;
  readonly frequency: number;
  readonly confidence: number;
  readonly description: string;
}

interface EnhancedStakingOpportunity extends StakingOpportunity {
  personalizedScore: number;
  compatibilityReason: string;
}


// UTILITIES


class Validator {
  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  static extractWalletAddress(text: string): string | null {
    const addressRegex = /0x[a-fA-F0-9]{40}/;
    const match = text.match(addressRegex);
    return match && this.isValidAddress(match[0]) ? match[0] : null;
  }
}

class Cache<T> {
  private readonly cache = new Map<string, { data: T; timestamp: number }>();

  constructor(private readonly ttl: number) {}

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }
}


// PROVIDERS


const stakingOpportunityProvider: Provider = {
   name: "stakingOpportunity",

  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    const cache = new Cache<StakingOpportunity[]>(5 * 60 * 1000); // 5 minutes
    
    const cached = cache.get("opportunities");
    if (cached) {
      elizaLogger.info("📋 Using cached opportunities");
      return cached;
    }

    elizaLogger.info("🔍 Fetching fresh staking opportunities...");

    try {
      const response: AxiosResponse = await axios.get("https://yields.llama.fi/pools", {
        timeout: 15000,
        headers: {
          "User-Agent": "StakingManager/1.0.0",
          Accept: "application/json",
        },
      });

      if (!response.data?.data) {
        return getFallbackOpportunities();
      }

      const opportunities = response.data.data
        .filter((pool: any) => isValidPool(pool))
        .map((pool: any) => mapPoolToOpportunity(pool))
        .filter((opp: StakingOpportunity) => opp.tvl >= 1000000)
        .sort((a: StakingOpportunity, b: StakingOpportunity) => b.apy - a.apy)
        .slice(0, 20);

      cache.set("opportunities", opportunities);
      elizaLogger.success(`✅ Fetched ${opportunities.length} valid opportunities`);

      return opportunities;
    } catch (error) {
      elizaLogger.error("❌ Error fetching opportunities:", error);
      return getFallbackOpportunities();
    }
  }
};


// HELPER FUNCTIONS


function isValidPool(pool: any): boolean {
  return (
    pool &&
    typeof pool.apy === "number" &&
    typeof pool.tvlUsd === "number" &&
    pool.apy > 0 &&
    pool.tvlUsd > 1000000 &&
    pool.symbol &&
    (pool.symbol.includes("ETH") || 
     pool.symbol.includes("BTC") || 
     pool.symbol.includes("USDC"))
  );
}

function mapPoolToOpportunity(pool: any): StakingOpportunity {
  return {
    protocol: pool.project || "Unknown",
    asset: pool.symbol || "Unknown",
    apy: parseFloat(pool.apy) || 0,
    tvl: parseFloat(pool.tvlUsd) || 0,
    riskLevel: assessRiskLevel(pool.project, parseFloat(pool.apy) || 0),
    lockPeriod: 0,
    minDeposit: 0.01,
    category: categorizePool(pool),
    contractAddress: pool.pool || "",
    description: `${pool.project} - ${pool.symbol} with ${parseFloat(pool.apy || 0).toFixed(2)}% APY`,
    lastUpdated: new Date(),
  };
}

function assessRiskLevel(protocol: string, apy: number): RiskLevel {
  const establishedProtocols = ["aave", "compound", "lido", "uniswap", "curve"];
  const isEstablished = establishedProtocols.some(p => 
    protocol?.toLowerCase().includes(p)
  );

  if (apy > 50) return "HIGH";
  if (apy > 20 && !isEstablished) return "HIGH";
  if (apy > 10) return "MEDIUM";
  return "LOW";
}

function categorizePool(pool: any): StakingCategory {
  const project = pool.project?.toLowerCase() || "";
  
  if (project.includes("lido") || project.includes("rocket")) {
    return "LIQUID_STAKING";
  }
  if (project.includes("aave") || project.includes("compound")) {
    return "LENDING";
  }
  if (project.includes("uniswap") || project.includes("curve")) {
    return "YIELD_FARMING";
  }
  return "RESTAKING";
}

function getFallbackOpportunities(): StakingOpportunity[] {
  elizaLogger.warn("⚠️ Using fallback opportunities");
  return [
    {
      protocol: "Lido",
      asset: "stETH",
      apy: 3.2,
      tvl: 32000000000,
      riskLevel: "LOW",
      lockPeriod: 0,
      minDeposit: 0.01,
      category: "LIQUID_STAKING",
      contractAddress: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84",
      description: "Lido liquid staking - most popular ETH staking solution",
      lastUpdated: new Date(),
    },
    {
      protocol: "Aave",
      asset: "USDC",
      apy: 4.8,
      tvl: 8500000000,
      riskLevel: "LOW",
      lockPeriod: 0,
      minDeposit: 1,
      category: "LENDING",
      contractAddress: "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",
      description: "Aave USDC lending with stable returns",
      lastUpdated: new Date(),
    },
  ];
}

function calculatePersonalizedScore(opp: StakingOpportunity, wallet: WalletAnalysis): number {
  let score = 0;

  // Base APY score (40%)
  score += Math.min(opp.apy * 2, 40);

  // Risk compatibility (30%)
  const riskMapping = { "LOW": 1, "MEDIUM": 2, "HIGH": 3 };
  const toleranceMapping = { "CONSERVATIVE": 1, "MODERATE": 2, "AGGRESSIVE": 3 };
  
  const oppRisk = riskMapping[opp.riskLevel];
  const userTolerance = toleranceMapping[wallet.riskProfile.riskTolerance || "MODERATE"];
  
  if (oppRisk <= userTolerance) score += 30;
  else if (oppRisk === userTolerance + 1) score += 15;

  // TVL safety score (20%)
  score += Math.min(Math.log10(opp.tvl / 1000000) * 5, 20);

  // Liquidity bonus (10%)
  if (opp.lockPeriod === 0) score += 10;
  else if (opp.lockPeriod <= wallet.riskProfile.lockPeriodTolerance) score += 5;

  return Math.min(score, 100);
}

function generateCompatibilityReason(opp: StakingOpportunity, wallet: WalletAnalysis): string {
  const reasons: string[] = [];

  reasons.push(`${opp.riskLevel.toLowerCase()} risk matches your ${wallet.riskProfile.riskTolerance.toLowerCase()} profile`);

  if (opp.lockPeriod === 0) {
    reasons.push("liquid staking provides flexibility");
  }

  if (opp.apy > 5) {
    reasons.push("attractive yield opportunity");
  }

  return reasons.join("; ");
}


const findStakingOpportunitiesAction: Action = {
  name: "FIND_STAKING_OPPORTUNITIES",
  similes: [
    "find staking opportunities",
    "show me staking options",
    "best staking yields",
    "staking recommendations"
  ],
  description: "Find and display current staking opportunities",
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';
    return text.includes("staking") || 
           text.includes("yield") || 
           text.includes("opportunities");
  },

  handler: async (
   runtime: IAgentRuntime, 
   message: Memory, 
   state?: State, 
   options?: { [key: string]: unknown }, 
   callback?: HandlerCallback
 ): Promise<void | ActionResult | undefined> => {
   try {
     elizaLogger.info("🔍 Fetching staking opportunities...");
     
     const opportunities = await stakingOpportunityProvider.get(runtime, message, state || {} as State);
     
     // Type assertion for provider result
     const stakingOpportunities = opportunities as StakingOpportunity[];

     if (!stakingOpportunities) {
       throw new Error("Failed to fetch staking opportunities");
     }

     const response = generateOpportunitiesResponse(stakingOpportunities);

     const result: ActionResult = {
       text: response,
       success: true,
       data: { opportunities: stakingOpportunities }
     };

     if (callback) {
       callback({
         text: response,
         content: {
           text: response,
           action: "FIND_STAKING_OPPORTUNITIES"
         }
       });
     }

     return result;
   } catch (error) {
     elizaLogger.error("Error fetching opportunities:", error);
     
     const errorMessage = "❌ Unable to fetch staking opportunities. Please try again later.";
     const errorResponse = {
       text: errorMessage,
       content: {
         text: errorMessage,
         action: "FIND_STAKING_OPPORTUNITIES"
       }
     };
     
     if (callback) {
       callback(errorResponse);
     }
     
     return { text: errorMessage, success: false };
   }
 },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Show me the best staking opportunities available" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "I'll fetch the current best staking opportunities for you...",
          action: "FIND_STAKING_OPPORTUNITIES",
        },
      },
    ],
  ] as ActionExample[][],
};


// RESPONSE GENERATORS


function generateOpportunitiesResponse(opportunities: StakingOpportunity[]): string {
  const topOpportunities = opportunities.slice(0, 10);
  
  return `🚀 **Current Staking Opportunities**\n\n` +
         
         `**Top ${topOpportunities.length} Opportunities:**\n` +
         topOpportunities.map((opp, index) =>
           `**${index + 1}. ${opp.protocol}** - ${opp.asset}\n` +
           `   📊 APY: ${opp.apy.toFixed(2)}%\n` +
           `   💰 TVL: ${(opp.tvl / 1000000).toFixed(1)}M\n` +
           `   ⚖️ Risk: ${opp.riskLevel} | 🔒 Lock: ${opp.lockPeriod} days\n` +
           `   📝 ${opp.description}\n`
         ).join('\n') + '\n' +
         
         `**Risk Levels:**\n` +
         `• 🟢 LOW: Established protocols, 2-8% APY\n` +
         `• 🟡 MEDIUM: Balanced risk/reward\n` +
         `• 🔴 HIGH: Higher yields, increased risk\n\n` +
         
         `*Use "analyze my wallet [address]" for personalized recommendations*`;
}


// PLUGIN EXPORT


export const EnhancedStakingManagerPlugin: Plugin = {
  name: "enhanced-staking-manager",
  description: "AI-powered staking opportunity discovery with personalized wallet analysis",
  actions: [
    ...walletAnalysisActions,
    findStakingOpportunitiesAction,
    selectStakingAction, 
    executeStakingAction
  ],
  evaluators: [],
  providers: [
    stakingOpportunityProvider,
    new WalletAnalyzer,
  ],
};

export const StakingManagerPluginWithMethods = {
  ...EnhancedStakingManagerPlugin,
  handleWalletAnalysis: async (message: Memory): Promise<string> => {
    try {
      const walletAddress = Validator.extractWalletAddress(message.content.text || '');
      if (!walletAddress) {
        return "❌ Please provide a valid wallet address to analyze.";
      }
      return `🔍 Analyzing wallet ${walletAddress}... Please use the action system for full analysis.`;
    } catch (error) {
      return "❌ Error analyzing wallet. Please try again.";
    }
  },
  
  handleStakingOpportunities: async (message: Memory): Promise<string> => {
    try {
      return "🔍 Fetching staking opportunities... Please use the action system for full results.";
    } catch (error) {
      return "❌ Error fetching opportunities. Please try again.";
    }
  }
};

export default EnhancedStakingManagerPlugin;