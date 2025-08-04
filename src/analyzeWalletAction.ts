import {
  type Action,
  type ActionExample,
  type ActionResult,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  elizaLogger,
} from '@elizaos/core';

import { WalletAnalyzer, Validator } from './wallet-analyzer.ts'; // Adjust import path as needed

// Import your types
import type {
  WalletAnalysis,
  StakingRecommendation,
  TokenHolding,
  StakingOption,
  BehaviorPattern,
  WalletRiskProfile,
  StakingStrategy,
} from './wallet-analyzer.ts';

// Enhanced types for personalized recommendations
interface EnhancedStakingRecommendation extends StakingRecommendation {
  personalizedScore?: number;
  compatibilityReason?: string;
  urgencyLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface StakingActionResult {
  walletAnalysis: WalletAnalysis;
  recommendations: EnhancedStakingRecommendation[];
  actionableInsights: string[];
  riskWarnings: string[];
}

// Utility functions for scoring and analysis
function calculatePersonalizedScore(
  recommendation: StakingRecommendation,
  analysis: WalletAnalysis
): number {
  let score = 50; // Base score

  // Risk alignment
  const riskAlignment = getRiskAlignment(recommendation, analysis.riskProfile);
  score += riskAlignment * 20;

  // Asset preference match
  const assetMatch = getAssetPreferenceMatch(recommendation, analysis);
  score += assetMatch * 15;

  // Liquidity compatibility
  const liquidityMatch = getLiquidityMatch(recommendation, analysis);
  score += liquidityMatch * 15;

  // Expected return weight
  const returnScore = Math.min(parseFloat(recommendation.expectedReturn) * 2, 10);
  score += returnScore;

  return Math.min(Math.max(score, 0), 100);
}

function getRiskAlignment(rec: StakingRecommendation, riskProfile: WalletRiskProfile): number {
  const recRisk = rec.options[0]?.riskLevel || 'MEDIUM';
  const userRisk = riskProfile.stakingRiskTolerance;

  if (recRisk === userRisk) return 1;
  if (
    (recRisk === 'LOW' && userRisk === 'MEDIUM') ||
    (recRisk === 'MEDIUM' && userRisk === 'HIGH') ||
    (recRisk === 'MEDIUM' && userRisk === 'LOW')
  ) return 0.7;
  return 0.3;
}

function getAssetPreferenceMatch(rec: StakingRecommendation, analysis: WalletAnalysis): number {
  const hasToken = analysis.tokenHoldings.some(token => token.symbol === rec.token);
  const tokenAmount = analysis.tokenHoldings.find(token => token.symbol === rec.token);
  
  if (!hasToken) return 0;
  if (tokenAmount && parseFloat(tokenAmount.balance) > parseFloat(rec.recommendedAmount)) return 1;
  return 0.5;
}

function getLiquidityMatch(rec: StakingRecommendation, analysis: WalletAnalysis): number {
  const lockPeriod = rec.options[0]?.lockPeriod || 0;
  const tolerance = analysis.riskProfile.lockPeriodTolerance;

  if (lockPeriod === 0) return 1; // Liquid staking always good
  if (lockPeriod <= tolerance) return 0.8;
  if (lockPeriod <= tolerance * 2) return 0.4;
  return 0.1;
}

function generateCompatibilityReason(
  rec: StakingRecommendation,
  analysis: WalletAnalysis
): string {
  const reasons: string[] = [];
  
  const hasToken = analysis.tokenHoldings.some(token => token.symbol === rec.token);
  if (hasToken) {
    reasons.push(`You already hold ${rec.token}`);
  }

  const riskMatch = getRiskAlignment(rec, analysis.riskProfile);
  if (riskMatch > 0.8) {
    reasons.push(`Matches your ${analysis.riskProfile.stakingRiskTolerance.toLowerCase()} risk tolerance`);
  }

  const relevantPattern = analysis.behaviorPatterns.find(pattern => 
    pattern.stakingImplication && pattern.stakingImplication.includes(rec.options[0]?.protocol || '')
  );
  if (relevantPattern) {
    reasons.push(`Aligns with your ${relevantPattern.pattern.toLowerCase()} behavior`);
  }

  if (rec.priority === "HIGH") {
    reasons.push("High potential returns for your portfolio size");
  }

  return reasons.length > 0 ? reasons.join(", ") : "Good fit for your portfolio";
}

function generateActionableInsights(analysis: WalletAnalysis): string[] {
  const insights: string[] = [];

  // Portfolio balance insights
  const totalBalance = parseFloat(analysis.totalBalance);
  if (totalBalance > 5) {
    insights.push("💰 Consider liquid staking for your large ETH holdings to earn passive yield");
  } else if (totalBalance > 0.1) {
    insights.push("🌱 Perfect balance size to start with liquid staking protocols");
  }

  // Diversification insights
  if (analysis.diversificationScore < 30) {
    insights.push("📊 Low diversification detected - consider staking across multiple protocols");
  } else if (analysis.diversificationScore > 70) {
    insights.push("✨ Excellent diversification - you can handle more sophisticated staking strategies");
  }

  // Token-specific insights
  const stablecoins = analysis.tokenHoldings.filter(token => 
    ['USDC', 'USDT', 'DAI'].includes(token.symbol)
  );
  if (stablecoins.length > 0) {
    insights.push("🏦 Your stablecoins can earn yield through lending protocols");
  }

  // Risk-based insights
  if (analysis.riskProfile.riskTolerance === 'CONSERVATIVE') {
    insights.push("🛡️ Focus on blue-chip liquid staking with established protocols");
  } else if (analysis.riskProfile.riskTolerance === 'AGGRESSIVE') {
    insights.push("🚀 You can explore restaking and higher-yield opportunities");
  }

  // Chain-specific insights
  const chainCount = Object.keys(analysis.nativeBalances).length;
  if (chainCount > 2) {
    insights.push("🌐 Multi-chain presence detected - optimize yields across different chains");
  }

  return insights;
}

function generateRiskWarnings(analysis: WalletAnalysis): string[] {
  const warnings: string[] = [];

  // Concentration risk
  if (analysis.riskProfile.concentrationRisk > 0.7) {
    warnings.push("⚠️ High concentration risk - avoid putting all funds in one protocol");
  }

  // Liquidity risk
  if (analysis.riskProfile.liquidityRisk > 0.6) {
    warnings.push("💧 Limited liquid assets - maintain emergency buffer before staking");
  }

  // Lock period warnings
  if (analysis.riskProfile.lockPeriodTolerance < 30) {
    warnings.push("🔒 Low lock period tolerance - stick to liquid staking options");
  }

  // Portfolio size warnings
  const totalBalance = parseFloat(analysis.totalBalance);
  if (totalBalance < 0.1) {
    warnings.push("💸 Small portfolio size - focus on building holdings before complex strategies");
  }

  // Gas cost warnings
  if (totalBalance < 1 && analysis.tokenHoldings.length > 5) {
    warnings.push("⛽ High token count vs balance - consider gas costs for staking transactions");
  }

  return warnings;
}

// MAIN ANALYSIS ACTION
const analyzeWalletAction: Action = {
  name: "ANALYZE_WALLET_AND_RECOMMEND",
  similes: [
    "analyze my wallet",
    "personalized recommendations", 
    "check my portfolio",
    "wallet analysis",
    "staking recommendations",
    "analyze portfolio",
    "wallet insights",
    "defi analysis"
  ],
  description: "Analyze user's wallet and provide comprehensive personalized staking recommendations based on holdings, behavior patterns, and risk profile",
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';
    const hasWalletAddress = Validator.extractWalletAddress(text);
    
    return (text.includes("analyze") && (text.includes("wallet") || text.includes("portfolio"))) ||
           text.includes("personalized") ||
           text.includes("recommend") ||
           text.includes("staking") ||
           !!hasWalletAddress;
  },

  handler: async (
    runtime: IAgentRuntime, 
    message: Memory, 
    state?: State, 
    options?: { [key: string]: unknown }, 
    callback?: HandlerCallback
  ): Promise<void | ActionResult | undefined> => {
    try {
      const walletAddress = Validator.extractWalletAddress(message.content.text || '');

      if (!walletAddress) {
        const errorResponse = {
          text: "❌ Please provide a valid wallet address to analyze. Example: 0x742d35Cc6654C2cFc2B28B44E8D9c8C0E4cB9fcE",
          content: {
            text: "❌ Please provide a valid wallet address to analyze. Example: 0x742d35Cc6654C2cFc2B28B44E8D9c8C0E4cB9fcE",
            action: "ANALYZE_WALLET_AND_RECOMMEND"
          }
        };

        if (callback) {
          callback(errorResponse);
        }
        return;
      }

      elizaLogger.info(`🎯 Starting comprehensive analysis for ${walletAddress}`);
      
      const walletAnalyzer = new WalletAnalyzer();
      const analysis = await walletAnalyzer.analyzeWallet(runtime, walletAddress);

      if (!analysis) {
        throw new Error("Failed to analyze wallet");
      }

      // Enhance recommendations with personalized scoring
      const enhancedRecommendations: EnhancedStakingRecommendation[] = analysis.stakingRecommendations
        .map((rec): EnhancedStakingRecommendation => {
          const score = calculatePersonalizedScore(rec, analysis);
          return {
            ...rec,
            personalizedScore: score,
            compatibilityReason: generateCompatibilityReason(rec, analysis),
            urgencyLevel: score > 80 ? "HIGH" : score > 60 ? "MEDIUM" : "LOW"
          };
        })
        .sort((a, b) => (b.personalizedScore || 0) - (a.personalizedScore || 0));

      const actionableInsights = generateActionableInsights(analysis);
      const riskWarnings = generateRiskWarnings(analysis);

      const response = generateComprehensiveAnalysisResponse(
        analysis, 
        enhancedRecommendations, 
        actionableInsights, 
        riskWarnings
      );

      const result: ActionResult = {
        text: response,
        success: true,
        data: {
          walletAnalysis: analysis,
          recommendations: enhancedRecommendations,
          actionableInsights,
          riskWarnings
        } as StakingActionResult
      };

      if (callback) {
        callback({
          text: result.text,
          success: result.success,
          data: result.data
        });
      }

      return result;
    } catch (error) {
      elizaLogger.error("Error in wallet analysis:", error);
      
      const errorMessage = "❌ Sorry, I encountered an error analyzing your wallet. Please try again later or check if the address is valid.";
      const errorResponse = {
        text: errorMessage,
        content: {
          text: errorMessage,
          action: "ANALYZE_WALLET_AND_RECOMMEND"
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
        content: { text: "Analyze my wallet 0x742d35Cc6654C2cFc2B28B44E8D9c8C0E4cB9fcE" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "I'll analyze your wallet's holdings, transaction patterns, and provide personalized staking recommendations based on your risk profile...",
          action: "ANALYZE_WALLET_AND_RECOMMEND",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "Give me personalized staking recommendations for 0x8765...4321" },
      },
      {
        user: "{{agentName}}",
        content: {
          text: "Analyzing your portfolio to find the best staking opportunities that match your behavior patterns and risk tolerance...",
          action: "ANALYZE_WALLET_AND_RECOMMEND",
        },
      },
    ],
  ] as ActionExample[][],
};

// QUICK STAKING CHECK ACTION
const quickStakingCheckAction: Action = {
  name: "QUICK_STAKING_CHECK",
  similes: [
    "quick staking check",
    "staking opportunities",
    "what can I stake",
    "stakeable assets",
    "earn yield",
    "passive income"
  ],
  description: "Quickly identify stakeable assets in user's wallet and provide immediate opportunities",
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';
    return text.includes("stake") || 
           text.includes("yield") || 
           text.includes("earn") ||
           text.includes("passive") ||
           (text.includes("quick") && text.includes("check"));
  },

  handler: async (
    runtime: IAgentRuntime, 
    message: Memory, 
    state?: State, 
    options?: { [key: string]: unknown }, 
    callback?: HandlerCallback
  ): Promise<void | ActionResult | undefined> => {
    try {
      const walletAddress = Validator.extractWalletAddress(message.content.text || '');

      if (!walletAddress) {
        const response = "🔍 **Quick Staking Opportunities Check**\n\n" +
                        "Please provide your wallet address to check for immediate staking opportunities!\n\n" +
                        "Example: `Quick staking check for 0x742d35Cc6654C2cFc2B28B44E8D9c8C0E4cB9fcE`";
        
        if (callback) {
          callback({ text: response });
        }
        return { text: response, success: true };
      }

      const walletAnalyzer = new WalletAnalyzer();
      const analysis = await walletAnalyzer.analyzeWallet(runtime, walletAddress);

      const response = generateQuickStakingResponse(analysis);

      const result: ActionResult = {
        text: response,
        success: true,
        data: { quickAnalysis: analysis }
      };

      if (callback) {
        callback({
         text: result.text,
         success: result.success,
         data: result.data
       });
      }

      return result;
    } catch (error) {
      elizaLogger.error("Error in quick staking check:", error);
      
      const errorMessage = "❌ Error checking staking opportunities. Please try again.";
      if (callback) {
        callback({ text: errorMessage });
      }
      return { text: errorMessage, success: false };
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Quick staking check for 0x123...abc" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "🔍 Checking your wallet for immediate staking opportunities...",
          action: "QUICK_STAKING_CHECK",
        },
      },
    ],
  ] as ActionExample[][],
};

// RISK ASSESSMENT ACTION
const riskAssessmentAction: Action = {
  name: "ASSESS_STAKING_RISK",
  similes: [
    "risk assessment",
    "how risky",
    "safe to stake",
    "risk profile",
    "staking risks",
    "is it safe"
  ],
  description: "Assess staking risks for user's portfolio and provide risk-adjusted recommendations",
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';
    return text.includes("risk") ||
           text.includes("safe") ||
           text.includes("dangerous") ||
           (text.includes("assess") && text.includes("stak"));
  },

  handler: async (
    runtime: IAgentRuntime, 
    message: Memory, 
    state?: State, 
    options?: { [key: string]: unknown }, 
    callback?: HandlerCallback
  ): Promise<void | ActionResult | undefined> => {
    try {
      const walletAddress = Validator.extractWalletAddress(message.content.text || '');

      if (!walletAddress) {
        const response = "⚖️ **Staking Risk Assessment**\n\n" +
                        "Provide your wallet address for a personalized risk assessment!\n\n" +
                        "I'll analyze your portfolio and suggest risk-appropriate staking strategies.";
        
        if (callback) {
          callback({ text: response });
        }
        return { text: response, success: true };
      }

      const walletAnalyzer = new WalletAnalyzer();
      const analysis = await walletAnalyzer.analyzeWallet(runtime, walletAddress);

      const response = generateRiskAssessmentResponse(analysis);

      const result: ActionResult = {
        text: response,
        success: true,
        data: { riskAnalysis: analysis.riskProfile }
      };

      if (callback) {
        callback({
         text: result.text,
         success: result.success,
         data: result.data
       });
      }

      return result;
    } catch (error) {
      elizaLogger.error("Error in risk assessment:", error);
      
      const errorMessage = "❌ Error assessing risks. Please try again.";
      if (callback) {
        callback({ text: errorMessage });
      }
      return { text: errorMessage, success: false };
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Assess staking risks for 0x456...def" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "⚖️ Analyzing your portfolio's risk profile for staking recommendations...",
          action: "ASSESS_STAKING_RISK",
        },
      },
    ],
  ] as ActionExample[][],
};

// Response generation functions
function generateComprehensiveAnalysisResponse(
  analysis: WalletAnalysis,
  recommendations: EnhancedStakingRecommendation[],
  insights: string[],
  warnings: string[]
): string {
  let response = `🧠 **Comprehensive Wallet Analysis & Personalized Staking Strategy**\n\n`;
  
  // Portfolio Overview
  response += `📊 **Portfolio Overview:**\n`;
  response += `• Address: ${analysis.address.slice(0, 6)}...${analysis.address.slice(-4)}\n`;
  response += `• Total Balance: ${parseFloat(analysis.totalBalance).toFixed(9)} ETH\n`;
  response += `• Token Holdings: ${analysis.tokenHoldings.length} tokens\n`;
  response += `• Active Chains: ${Object.keys(analysis.nativeBalances).length}\n`;
  response += `• Diversification Score: ${analysis.diversificationScore}/100\n`;
  response += `• Current Staking: ${analysis.currentStakingPositions.length} positions\n\n`;
  
  // Risk Profile
  response += `⚖️ **Risk Profile:**\n`;
  response += `• Overall Risk Score: ${analysis.riskProfile.riskScore}/100\n`;
  response += `• Risk Tolerance: ${analysis.riskProfile.riskTolerance}\n`;
  response += `• Staking Risk Tolerance: ${analysis.riskProfile.stakingRiskTolerance}\n`;
  response += `• Max Single Position: ${analysis.riskProfile.maxSinglePosition} ETH\n`;
  response += `• Lock Period Tolerance: ${analysis.riskProfile.lockPeriodTolerance} days\n\n`;
  
  // Personalized Strategy
  response += `🎯 **Personalized Staking Strategy:**\n`;
  response += `• Recommended Allocation: ${analysis.stakingStrategy.recommendedAllocation}%\n`;
  response += `• Preferred Protocols: ${analysis.stakingStrategy.preferredProtocols.join(', ')}\n`;
  response += `• Liquidity Buffer: ${analysis.stakingStrategy.liquidityBuffer}%\n`;
  response += `• Investment Horizon: ${analysis.stakingStrategy.stakingHorizon} days\n\n`;

  // Top Recommendations
  if (recommendations.length > 0) {
    response += `💡 **Top Personalized Recommendations:**\n`;
    recommendations.slice(0, 3).forEach((rec, index) => {
      response += `\n**${index + 1}. ${rec.token} Staking** (${rec.urgencyLevel} Priority)\n`;
      response += `   💰 Amount: ${rec.recommendedAmount} ${rec.token}\n`;
      response += `   📈 Expected Return: ${rec.expectedReturn}\n`;
      response += `   🎯 Compatibility Score: ${rec.personalizedScore?.toFixed(1)}/100\n`;
      response += `   💭 Why This Works: ${rec.compatibilityReason}\n`;
      
      if (rec.options[0]) {
        response += `   🏛️ Protocol: ${rec.options[0].protocol} (${rec.options[0].expectedApr}% APR)\n`;
        response += `   🔒 Lock Period: ${rec.options[0].lockPeriod || 0} days\n`;
        response += `   ⚠️ Risk Level: ${rec.options[0].riskLevel}\n`;
      }
    });
    response += '\n';
  }

  // Behavioral Insights
  if (analysis.behaviorPatterns.length > 0) {
    response += `🎭 **Behavioral Patterns:**\n`;
    analysis.behaviorPatterns.slice(0, 2).forEach(pattern => {
      response += `• ${pattern.pattern}: ${pattern.description}\n`;
      if (pattern.stakingImplication) {
        response += `  💡 Staking Insight: ${pattern.stakingImplication}\n`;
      }
    });
    response += '\n';
  }

  // Actionable Insights
  if (insights.length > 0) {
    response += `💡 **Actionable Insights:**\n`;
    insights.forEach(insight => response += `${insight}\n`);
    response += '\n';
  }

  // Risk Warnings
  if (warnings.length > 0) {
    response += `⚠️ **Risk Warnings:**\n`;
    warnings.forEach(warning => response += `${warning}\n`);
    response += '\n';
  }

  // Next Steps
  response += `📋 **Next Steps:**\n`;
  if (recommendations.length > 0) {
    const topRec = recommendations[0];
    response += `1. **Start Here**: Stake ${topRec.recommendedAmount} ${topRec.token} with ${topRec.options[0]?.protocol}\n`;
    response += `2. **Monitor**: Track performance and adjust based on market conditions\n`;
    response += `3. **Scale**: Gradually increase allocation as you gain confidence\n`;
    response += `4. **Diversify**: Consider ${analysis.stakingStrategy.diversificationGoal} protocols for optimal risk management\n`;
  } else {
    response += `1. **Build Position**: Accumulate more ETH or stablecoins for staking\n`;
    response += `2. **Start Small**: Begin with liquid staking when you reach minimum thresholds\n`;
    response += `3. **Learn**: Research the recommended protocols while building your position\n`;
  }

  return response;
}

function generateQuickStakingResponse(analysis: WalletAnalysis): string {
  let response = `🔍 **Quick Staking Opportunities Check**\n\n`;
  
  const ethBalance = parseFloat(analysis.totalBalance);
  const stakeableTokens = analysis.tokenHoldings.filter(token => token.isStakeable);
  const immediateOpportunities = analysis.stakingRecommendations.filter(rec => 
    rec.priority === "HIGH" || rec.priority === "MEDIUM"
  );

  response += `**🎯 Immediate Opportunities:**\n`;
  
  if (ethBalance > 0.01) {
    response += `• **ETH Liquid Staking**: ${ethBalance.toFixed(9)} ETH ready\n`;
    response += `  → Start with Lido (3.2% APR) or Rocket Pool (3.1% APR)\n`;
  }

  if (stakeableTokens.length > 0) {
    stakeableTokens.slice(0, 3).forEach(token => {
      response += `• **${token.symbol} Lending**: ${token.balance} ${token.symbol} available\n`;
      if (token.stakingOptions && token.stakingOptions[0]) {
        response += `  → ${token.stakingOptions[0].protocol} (${token.stakingOptions[0].expectedApr}% APR)\n`;
      }
    });
  }

  if (immediateOpportunities.length === 0 && ethBalance < 0.01) {
    response += `• **Build Position**: Accumulate 0.1+ ETH to start liquid staking\n`;
    response += `• **Stablecoin Strategy**: Consider USDC/DAI for lending yield\n`;
  }

  response += `\n**📊 Quick Stats:**\n`;
  response += `• Stakeable Assets: ${stakeableTokens.length}\n`;
  response += `• Total Staking Capacity: ${analysis.liquidityNeeds.stakingCapacity.toFixed(9)} ETH\n`;
  response += `• Risk Level: ${analysis.riskProfile.stakingRiskTolerance}\n`;

  if (immediateOpportunities.length > 0) {
    response += `\n**🚀 Top Quick Win:**\n`;
    const topOpp = immediateOpportunities[0];
    response += `${topOpp.token}: ${topOpp.recommendedAmount} → ${topOpp.expectedReturn} annually\n`;
  }

  response += `\n💡 *Use "analyze my wallet [address]" for detailed strategy*`;

  return response;
}

function generateRiskAssessmentResponse(analysis: WalletAnalysis): string {
  let response = `⚖️ **Comprehensive Staking Risk Assessment**\n\n`;
  
  const riskProfile = analysis.riskProfile;
  
  response += `**📊 Overall Risk Score: ${riskProfile.riskScore}/100**\n\n`;
  
  // Risk Level Interpretation
  response += `**🎯 Risk Profile: ${riskProfile.riskTolerance}**\n`;
  if (riskProfile.riskTolerance === 'CONSERVATIVE') {
    response += `• Stick to blue-chip liquid staking (Lido, Coinbase)\n`;
    response += `• Maximum 40% portfolio allocation to staking\n`;
    response += `• Avoid lock periods > 7 days\n`;
  } else if (riskProfile.riskTolerance === 'MODERATE') {
    response += `• Balanced approach with established protocols\n`;
    response += `• Up to 60% allocation across 2-3 protocols\n`;
    response += `• Lock periods up to 30 days acceptable\n`;
  } else if (riskProfile.riskTolerance === 'AGGRESSIVE') {
    response += `• Explore high-yield opportunities (EigenLayer, newer protocols)\n`;
    response += `• Up to 80% allocation across multiple strategies\n`;
    response += `• Comfortable with 90+ day lock periods\n`;
  }

  response += `\n**⚠️ Specific Risk Factors:**\n`;
  
  // Concentration Risk
  if (riskProfile.concentrationRisk > 0.5) {
    response += `• **HIGH Concentration Risk** (${(riskProfile.concentrationRisk * 100).toFixed(1)}%)\n`;
    response += `  → Diversify across multiple protocols to reduce single-point failure\n`;
  } else {
    response += `• **LOW Concentration Risk** ✅ Good diversification\n`;
  }
  
  // Liquidity Risk
  if (riskProfile.liquidityRisk > 0.5) {
    response += `• **MEDIUM-HIGH Liquidity Risk**\n`;
    response += `  → Maintain 20%+ in liquid assets before staking\n`;
  } else {
    response += `• **LOW Liquidity Risk** ✅ Good liquid asset base\n`;
  }

  // Portfolio Size Risk
  const totalBalance = parseFloat(analysis.totalBalance);
  if (totalBalance < 1) {
    response += `• **Small Portfolio Risk**: Gas costs may impact returns\n`;
    response += `  → Focus on single high-quality protocol to minimize fees\n`;
  } else if (totalBalance > 50) {
    response += `• **Large Portfolio Advantage**: Can diversify effectively ✅\n`;
  }

  response += `\n**🛡️ Risk Mitigation Strategy:**\n`;
  response += `• Max Single Position: ${riskProfile.maxSinglePosition} ETH\n`;
  response += `• Emergency Buffer: ${analysis.liquidityNeeds.emergencyBuffer.toFixed(9)} ETH\n`;
  response += `• Recommended Lock Period: ≤ ${riskProfile.lockPeriodTolerance} days\n`;

  // Safe staking recommendations based on risk
  response += `\n**✅ Risk-Appropriate Recommendations:**\n`;
  const safeRecs = analysis.stakingRecommendations.filter(rec => {
    const optionRisk = rec.options[0]?.riskLevel;
    if (riskProfile.stakingRiskTolerance === 'LOW') return optionRisk === 'LOW';
    if (riskProfile.stakingRiskTolerance === 'MEDIUM') return optionRisk !== 'HIGH';
    return true;
  });

  if (safeRecs.length > 0) {
    safeRecs.slice(0, 2).forEach((rec, index) => {
      response += `${index + 1}. ${rec.token} via ${rec.options[0]?.protocol} (${rec.options[0]?.riskLevel} risk)\n`;
      response += `   💰 Amount: ${rec.recommendedAmount} ${rec.token}\n`;
      response += `   📈 Expected: ${rec.expectedReturn}\n`;
    });
  } else {
    response += `• Build larger position before staking (current: ${totalBalance.toFixed(9)} ETH)\n`;
    response += `• Start with stablecoin lending for lower-risk yield\n`;
  }

  response += `\n**📋 Risk Management Checklist:**\n`;
  response += `□ Maintain emergency fund (${analysis.liquidityNeeds.emergencyBuffer.toFixed(9)} ETH)\n`;
  response += `□ Never stake more than ${riskProfile.maxSinglePosition} ETH in one protocol\n`;
  response += `□ Start with liquid staking before locked positions\n`;
  response += `□ Research protocol audits and track record\n`;
  response += `□ Monitor staking positions regularly\n`;

  return response;
}

// PORTFOLIO OPTIMIZATION ACTION
const optimizePortfolioAction: Action = {
  name: "OPTIMIZE_STAKING_PORTFOLIO",
  similes: [
    "optimize portfolio",
    "improve staking",
    "better yields",
    "maximize returns",
    "portfolio optimization",
    "rebalance staking"
  ],
  description: "Analyze current staking positions and suggest optimizations for better risk-adjusted returns",
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';
    return text.includes("optimize") ||
           text.includes("improve") ||
           text.includes("maximize") ||
           text.includes("better") ||
           (text.includes("rebalance") && text.includes("stak"));
  },

  handler: async (
    runtime: IAgentRuntime, 
    message: Memory, 
    state?: State, 
    options?: { [key: string]: unknown }, 
    callback?: HandlerCallback
  ): Promise<void | ActionResult | undefined> => {
    try {
      const walletAddress = Validator.extractWalletAddress(message.content.text || '');

      if (!walletAddress) {
        const response = "🎯 **Portfolio Optimization Service**\n\n" +
                        "Provide your wallet address to analyze current positions and suggest optimizations!\n\n" +
                        "I'll help you maximize yield while managing risk appropriately.";
        
        if (callback) {
          callback({ text: response });
        }
        return { text: response, success: true };
      }

      const walletAnalyzer = new WalletAnalyzer();
      const analysis = await walletAnalyzer.analyzeWallet(runtime, walletAddress);

      const response = generateOptimizationResponse(analysis);

      const result: ActionResult = {
        text: response,
        success: true,
        data: { optimization: analysis }
      };

      if (callback) {
        callback({
         text: result.text,
         success: result.success,
         data: result.data
       });
      }
      

      return result;
    } catch (error) {
      elizaLogger.error("Error in portfolio optimization:", error);
      
      const errorMessage = "❌ Error optimizing portfolio. Please try again.";
      if (callback) {
        callback({ text: errorMessage });
      }
      return { text: errorMessage, success: false };
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Optimize my staking portfolio 0x789...ghi" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "🎯 Analyzing your current positions to suggest optimizations for better risk-adjusted returns...",
          action: "OPTIMIZE_STAKING_PORTFOLIO",
        },
      },
    ],
  ] as ActionExample[][],
};

function generateOptimizationResponse(analysis: WalletAnalysis): string {
  let response = `🎯 **Portfolio Optimization Analysis**\n\n`;
  
  const currentStaking = analysis.currentStakingPositions;
  const totalBalance = parseFloat(analysis.totalBalance);
  const stakingCapacity = analysis.liquidityNeeds.stakingCapacity;
  
  response += `**📊 Current State:**\n`;
  response += `• Total Portfolio: ${totalBalance.toFixed(9)} ETH\n`;
  response += `• Currently Staked: ${currentStaking.length} positions\n`;
  response += `• Available to Stake: ${stakingCapacity.toFixed(9)} ETH\n`;
  response += `• Diversification: ${analysis.diversificationScore}/100\n\n`;

  // Current staking analysis
  if (currentStaking.length > 0) {
    response += `**🔒 Current Staking Positions:**\n`;
    currentStaking.forEach(position => {
      response += `• ${position.symbol}: ${position.balance} (${position.chainName})\n`;
    });
    response += '\n';
  }

  // Optimization opportunities
  response += `**⚡ Optimization Opportunities:**\n`;
  
  // Check for unstaked ETH
  if (totalBalance > 0.1 && currentStaking.length === 0) {
    response += `🚀 **High Priority**: Stake ${(totalBalance * 0.7).toFixed(9)} ETH for ~3.2% APR\n`;
    response += `   → Potential annual earnings: ${(totalBalance * 0.7 * 0.032).toFixed(9)} ETH\n`;
  }

  // Check for suboptimal allocations
  const currentAllocation = currentStaking.reduce((sum, pos) => sum + parseFloat(pos.balance), 0);
  const optimalAllocation = totalBalance * (analysis.stakingStrategy.recommendedAllocation / 100);
  
  if (currentAllocation < optimalAllocation * 0.8) {
    const additional = optimalAllocation - currentAllocation;
    response += `📈 **Underallocated**: Consider staking additional ${additional.toFixed(9)} ETH\n`;
    response += `   → Current: ${((currentAllocation/totalBalance)*100).toFixed(1)}% | Optimal: ${analysis.stakingStrategy.recommendedAllocation}%\n`;
  }

  // Diversification improvements
  if (analysis.diversificationScore < 50 && totalBalance > 5) {
    response += `🌐 **Diversification**: Spread across ${analysis.stakingStrategy.diversificationGoal} protocols\n`;
    response += `   → Reduces single protocol risk\n`;
  }

  // Yield improvements
  const stakeableTokens = analysis.tokenHoldings.filter(token => 
    token.isStakeable && parseFloat(token.balance) > 50
  );
  
  if (stakeableTokens.length > 0) {
    response += `💰 **Idle Assets**: ${stakeableTokens.length} tokens earning 0% yield\n`;
    stakeableTokens.slice(0, 2).forEach(token => {
      response += `   • ${token.symbol}: ${token.balance} → ${token.stakingOptions?.[0]?.expectedApr || 'N/A'}% APR available\n`;
    });
  }

  // Specific recommendations
  response += `\n**🎯 Optimization Plan:**\n`;
  
  const topRecommendations = analysis.stakingRecommendations
    .filter(rec => rec.priority === "HIGH" || rec.priority === "MEDIUM")
    .slice(0, 3);

  if (topRecommendations.length > 0) {
    topRecommendations.forEach((rec, index) => {
      response += `\n**Step ${index + 1}: ${rec.token} Optimization**\n`;
      response += `• Stake: ${rec.recommendedAmount} ${rec.token}\n`;
      response += `• Protocol: ${rec.options[0]?.protocol} (${rec.options[0]?.expectedApr}% APR)\n`;
      response += `• Expected Return: ${rec.expectedReturn}\n`;
      response += `• Risk Level: ${rec.options[0]?.riskLevel}\n`;
      response += `• Why: ${rec.reasoning}\n`;
    });
  } else {
    response += `• **Build Position**: Focus on accumulating ETH for liquid staking\n`;
    response += `• **Target**: 0.1+ ETH minimum for cost-effective staking\n`;
    response += `• **Strategy**: DCA into ETH, then stake incrementally\n`;
  }

  // Expected improvements
  response += `\n**📈 Expected Improvements:**\n`;
  const potentialYield = topRecommendations.reduce((sum, rec) => {
    const amount = parseFloat(rec.recommendedAmount);
    const apr = rec.options[0]?.expectedApr || 0;
    return sum + (amount * apr / 100);
  }, 0);

  if (potentialYield > 0) {
    response += `• Additional Annual Yield: ${potentialYield.toFixed(9)} tokens\n`;
    response += `• Improved Risk Score: +${Math.min(analysis.diversificationScore * 0.1, 10).toFixed(0)} points\n`;
    response += `• Better Diversification: ${Math.min(analysis.diversificationScore + 15, 100)}/100\n`;
  }

  // Implementation timeline
  response += `\n**⏰ Implementation Timeline:**\n`;
  response += `• **Week 1**: Start with highest priority recommendation\n`;
  response += `• **Week 2-4**: Gradually increase allocation to target %\n`;
  response += `• **Month 2**: Add secondary protocols for diversification\n`;
  response += `• **Ongoing**: Monitor and rebalance quarterly\n`;

  // Risk considerations
  response += `\n**⚠️ Optimization Risks:**\n`;
  response += `• Smart contract risk in new protocols\n`;
  response += `• Liquidity risk if over-allocating to locked staking\n`;
  response += `• Gas costs for small position adjustments\n`;
  response += `• Market timing risk during transitions\n`;

  return response;
}

// EXPORT ALL ACTIONS
export const walletAnalysisActions: Action[] = [
  analyzeWalletAction,
  quickStakingCheckAction,
  riskAssessmentAction,
  optimizePortfolioAction,
];

// Main plugin export structure
export default {
  name: "wallet-analysis-actions",
  description: "Comprehensive wallet analysis and personalized staking recommendation actions",
  actions: walletAnalysisActions,
};