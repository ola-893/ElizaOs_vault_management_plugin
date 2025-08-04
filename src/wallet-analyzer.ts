import {
  type Address,
  type Chain,
  formatUnits,
  parseAbi,
} from 'viem';

async function initializeEvmPlugin() {
  let evmWalletProvider: any;
  let initWalletProvider: any;
  let WalletProvider: any;

  try {
    // @ts-ignore
    const evmPlugin = await import("@elizaos/plugin-evm");
    evmWalletProvider = evmPlugin.evmWalletProvider;
    initWalletProvider = evmPlugin.initWalletProvider;
    WalletProvider = evmPlugin.WalletProvider;
    return { evmWalletProvider, initWalletProvider, WalletProvider };
  } catch (error) {
    console.warn("@elizaos/plugin-evm not available, using fallback mode", error);
    return { evmWalletProvider: null, initWalletProvider: null, WalletProvider: null };
  }
}

// Usage
const { evmWalletProvider, initWalletProvider, WalletProvider } = await initializeEvmPlugin();

import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  type State,
  elizaLogger,
} from '@elizaos/core';


// Extended type definitions for comprehensive analysis
export interface TokenHolding {
  symbol: string;
  name: string;
  address: string;
  balance: string;
  decimals: number;
  chainName: string;
  usdValue?: number;
  percentage?: number;
  isStakeable?: boolean;
  stakingOptions?: StakingOption[];
}

export interface StakingOption {
  protocol: string;
  type: "LIQUID" | "LOCKED" | "RESTAKING";
  expectedApr: number;
  minAmount: string;
  lockPeriod?: number; // days
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  chainName: string;
  contractAddress?: string;
}

export interface StakingRecommendation {
  recommendedAmount: string;
  token: string;
  options: StakingOption[];
  reasoning: string;
  riskAssessment: string;
  expectedReturn: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface TokenBalanceData {
  address: string;
  chainName: string;
  nativeBalance: string;
  tokenHoldings: TokenHolding[];
  totalUsdValue: number;
}

export interface WalletAnalysis {
  address: string;
  totalBalance: string;
  portfolioValue: string;
  transactionCount: number;
  tokenHoldings: TokenHolding[];
  nativeBalances: Record<string, string>;
  totalUsdValue: number;
  diversificationScore: number;
  stakingRecommendations: StakingRecommendation[];
  currentStakingPositions: TokenHolding[];
  protocolInteractions?: ProtocolInteraction[];
  riskProfile: WalletRiskProfile;
  stakingStrategy: StakingStrategy;
  behaviorPatterns: BehaviorPattern[];
  preferredAssets: AssetPreference[];
  liquidityNeeds: LiquidityProfile;
  evmCapabilities: EVMCapabilities;
  tokenAnalysis: TokenAnalysis;
}

export interface StakingStrategy {
  recommendedAllocation: number; // percentage to stake
  preferredProtocols: string[];
  riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "DEGENERATE" | "UNKNOWN";
  liquidityBuffer: number; // percentage to keep liquid
  stakingHorizon: number; // days
  diversificationGoal: number; // number of protocols
}

interface TokenAnalysis {
  totalTokens: number;
  majorHoldings: TokenHolding[];
  stablecoins: TokenHolding[];
  defiTokens: TokenHolding[];
  governanceTokens: TokenHolding[];
  stakeableAssets: TokenHolding[];
  concentrationRisk: number;
  diversificationLevel: "LOW" | "MEDIUM" | "HIGH";
}

interface ProtocolInteraction {
  protocol: string;
  interactionCount: number;
  totalVolume: number;
  avgTransactionSize: number;
  lastInteraction: Date;
  interactionTypes: string[];
  successRate: number;
}

export interface WalletRiskProfile {
  riskScore: number;
  riskTolerance: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "DEGENERATE" | "UNKNOWN";
  maxSinglePosition: string;
  diversificationLevel: "LOW" | "MEDIUM" | "HIGH" | "UNKNOWN";
  lockPeriodTolerance: number;
  concentrationRisk: number;
  liquidityRisk: number;
  stakingRiskTolerance: "LOW" | "MEDIUM" | "HIGH";
}

export interface BehaviorPattern {
  pattern: string;
  frequency: number;
  confidence: number;
  description: string;
  stakingImplication?: string;
}

interface AssetPreference {
  token: string;
  preference: number;
  volume: string;
  type: "NATIVE" | "ERC20" | "STABLECOIN" | "DEFI";
  stakingPotential?: number;
}

interface LiquidityProfile {
  liquidityRatio: number;
  withdrawalFrequency: number;
  emergencyBuffer: number;
  preferredLockPeriods: number[];
  liquidAssets: TokenHolding[];
  stakedAssets: TokenHolding[];
  stakingCapacity: number; // how much can be staked safely
}

interface EVMCapabilities {
  canTransfer: boolean;
  canBridge: boolean;
  canSwap: boolean;
  canStake: boolean;
  supportedChains: string[];
  preferredDEXs: string[];
  stakingProtocols: string[];
}

// Simple cache implementation
class Cache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private ttl: number;

  constructor(ttl: number) {
    this.ttl = ttl;
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

// Internal Token Balance Provider
class InternalTokenBalanceProvider {
  private cache: Cache<TokenBalanceData[]> = new Cache(5 * 60 * 1000); // 5 minutes

  // Comprehensive token database with staking information
  private static readonly TOKEN_DATABASE = {
    mainnet: [
      { 
        address: '0xA0b86a33E6Db485E0f65b2f8b4b92c0e7b9c2c1e', 
        symbol: 'USDC', 
        name: 'USD Coin', 
        decimals: 6,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: 'Aave',
            type: 'LIQUID' as const,
            expectedApr: 4.5,
            minAmount: '100',
            riskLevel: 'LOW' as const,
            description: 'Lending USDC on Aave for stable yield',
            chainName: 'mainnet'
          },
          {
            protocol: 'Compound',
            type: 'LIQUID' as const,
            expectedApr: 3.8,
            minAmount: '50',
            riskLevel: 'LOW' as const,
            description: 'Supply USDC to Compound for lending yield',
            chainName: 'mainnet'
          }
        ]
      },
      { 
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', 
        symbol: 'USDT', 
        name: 'Tether USD', 
        decimals: 6,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: 'Aave',
            type: 'LIQUID' as const,
            expectedApr: 4.2,
            minAmount: '100',
            riskLevel: 'LOW' as const,
            description: 'Lend USDT on Aave for stable returns',
            chainName: 'mainnet'
          }
        ]
      },
      { 
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', 
        symbol: 'DAI', 
        name: 'Dai Stablecoin', 
        decimals: 18,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: 'MakerDAO DSR',
            type: 'LIQUID' as const,
            expectedApr: 5.0,
            minAmount: '1',
            riskLevel: 'LOW' as const,
            description: 'Earn DAI Savings Rate directly from MakerDAO',
            chainName: 'mainnet'
          },
          {
            protocol: 'Aave',
            type: 'LIQUID' as const,
            expectedApr: 4.3,
            minAmount: '50',
            riskLevel: 'LOW' as const,
            description: 'Supply DAI to Aave lending pool',
            chainName: 'mainnet'
          }
        ]
      },
      { 
        address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984', 
        symbol: 'UNI', 
        name: 'Uniswap', 
        decimals: 18,
        isStakeable: false // Governance token, no direct staking
      },
      { 
        address: '0xae7ab96520de3a18e5e111b5eaab095312d7fe84', 
        symbol: 'stETH', 
        name: 'Lido Staked Ether', 
        decimals: 18,
        isStakeable: false // Already staked ETH
      },
    ],
    base: [
      { 
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 
        symbol: 'USDC', 
        name: 'USD Coin', 
        decimals: 6,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: 'Moonwell',
            type: 'LIQUID' as const,
            expectedApr: 3.5,
            minAmount: '50',
            riskLevel: 'MEDIUM' as const,
            description: 'Supply USDC to Moonwell lending market on Base',
            chainName: 'base'
          }
        ]
      },
      { 
        address: '0x4200000000000000000000000000000000000006', 
        symbol: 'WETH', 
        name: 'Wrapped Ether', 
        decimals: 18,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: 'Moonwell',
            type: 'LIQUID' as const,
            expectedApr: 2.8,
            minAmount: '0.1',
            riskLevel: 'MEDIUM' as const,
            description: 'Supply WETH to Moonwell for lending yield',
            chainName: 'base'
          }
        ]
      },
    ],
    arbitrum: [
      { 
        address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 
        symbol: 'USDC', 
        name: 'USD Coin', 
        decimals: 6,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: 'Radiant',
            type: 'LIQUID' as const,
            expectedApr: 4.0,
            minAmount: '50',
            riskLevel: 'MEDIUM' as const,
            description: 'Lend USDC on Radiant Capital for yield',
            chainName: 'arbitrum'
          }
        ]
      },
      { 
        address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 
        symbol: 'WETH', 
        name: 'Wrapped Ether', 
        decimals: 18,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: 'Radiant',
            type: 'LIQUID' as const,
            expectedApr: 2.5,
            minAmount: '0.1',
            riskLevel: 'MEDIUM' as const,
            description: 'Supply WETH to Radiant lending pool',
            chainName: 'arbitrum'
          }
        ]
      },
    ]
  };

  // Native ETH staking options
  public static readonly ETH_STAKING_OPTIONS: StakingOption[] = [
    {
      protocol: 'Lido',
      type: 'LIQUID',
      expectedApr: 3.2,
      minAmount: '0.01',
      riskLevel: 'LOW',
      description: 'Liquid staking with Lido - get stETH tokens',
      chainName: 'mainnet'
    },
    {
      protocol: 'Rocket Pool',
      type: 'LIQUID',
      expectedApr: 3.1,
      minAmount: '0.01',
      riskLevel: 'LOW',
      description: 'Decentralized liquid staking with Rocket Pool',
      chainName: 'mainnet'
    },
    {
      protocol: 'Coinbase Wrapped Staked ETH',
      type: 'LIQUID',
      expectedApr: 3.0,
      minAmount: '0.001',
      riskLevel: 'LOW',
      description: 'Coinbase institutional staking solution',
      chainName: 'mainnet'
    },
    {
      protocol: 'EigenLayer',
      type: 'RESTAKING',
      expectedApr: 4.5,
      minAmount: '32',
      lockPeriod: 21,
      riskLevel: 'HIGH',
      description: 'Restake ETH for additional AVS rewards (higher risk)',
      chainName: 'mainnet'
    }
  ];

  // ERC-20 ABI for balance checking
  private static readonly ERC20_ABI = parseAbi([
    'function balanceOf(address owner) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)',
  ]);

  async getTokenBalances(walletProvider: any, address: Address): Promise<TokenBalanceData[]> {
    const cacheKey = `${address}_token_balances`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      elizaLogger.info(`📋 Using cached token balances for ${address}`);
      return cached;
    }

    const supportedChains = walletProvider.getSupportedChains();
    const tokenBalances: TokenBalanceData[] = [];

    await Promise.all(
      supportedChains.map(async (chainName:string) => {
        try {
          const chainData = await this.getTokenBalancesForChain(walletProvider, address, chainName);
          if (chainData.tokenHoldings.length > 0 || parseFloat(chainData.nativeBalance) > 0) {
            tokenBalances.push(chainData);
          }
        } catch (error) {
          elizaLogger.warn(`Failed to get token balances for ${chainName}:`, error);
        }
      })
    );

    this.cache.set(cacheKey, tokenBalances);
    return tokenBalances;
  }

  private async getTokenBalancesForChain(
    walletProvider: any, 
    address: Address, 
    chainName: string
  ): Promise<TokenBalanceData> {
    const client = walletProvider.getPublicClient(chainName);
    
    // Get native balance
    const nativeBalance = await client.getBalance({ address });
    const nativeBalanceFormatted = formatUnits(nativeBalance, 18);

    // Get tokens for this chain
    const tokens = (InternalTokenBalanceProvider.TOKEN_DATABASE as any)[chainName] || [];
    const tokenHoldings: TokenHolding[] = [];

    // Check balances for each token
    await Promise.all(
      tokens.map(async (tokenConfig: any) => {
        try {
          const balance = await client.readContract({
            address: tokenConfig.address as Address,
            abi: InternalTokenBalanceProvider.ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          });

          if (balance && balance > 0n) {
            const formattedBalance = formatUnits(balance, tokenConfig.decimals);
            
            if (parseFloat(formattedBalance) > 0.001) { // Filter out dust
              tokenHoldings.push({
                symbol: tokenConfig.symbol,
                name: tokenConfig.name,
                address: tokenConfig.address,
                balance: formattedBalance,
                decimals: tokenConfig.decimals,
                chainName,
                isStakeable: tokenConfig.isStakeable || false,
                stakingOptions: tokenConfig.stakingOptions || []
              });
            }
          }
        } catch (error) {
          elizaLogger.debug(`Failed to get ${tokenConfig.symbol} balance on ${chainName}:`, error);
        }
      })
    );

    return {
      address: address as string,
      chainName,
      nativeBalance: nativeBalanceFormatted,
      tokenHoldings,
      totalUsdValue: 0, // Would need price API integration
    };
  }
}

// Validator utility
export class Validator {
  static extractWalletAddress(text: string): string | null {
    // Match Ethereum addresses (0x followed by 40 hex characters)
    const ethAddressRegex = /0x[a-fA-F0-9]{40}/;
    const match = text.match(ethAddressRegex);
    return match ? match[0] : null;
  }

  static isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

export class WalletAnalyzer implements Provider {
  name = "walletAnalyzer";
  private cache: Cache<WalletAnalysis> = new Cache(10 * 60 * 1000); // 10 minutes
  private tokenBalanceProvider: InternalTokenBalanceProvider;

  constructor() {
    this.tokenBalanceProvider = new InternalTokenBalanceProvider();
  }

  public async get(runtime: IAgentRuntime, message: Memory, state?: State): Promise<ProviderResult> {
    const walletAddress = Validator.extractWalletAddress(message.content.text || '');
    
    if (!walletAddress || !Validator.isValidAddress(walletAddress)) {
      throw new Error("Invalid wallet address provided");
    }

    try {
      const analysis = await this.analyzeWallet(runtime, walletAddress);
      
      // Format comprehensive response with staking focus
      const agentName = state?.agentName || 'The agent';
      
      return {
        text: this.formatAnalysisWithStaking(analysis, agentName),
        data: analysis,
        values: {
          address: analysis.address,
          totalBalance: analysis.totalBalance,
          totalTokens: analysis.tokenHoldings.length.toString(),
          stakingRecommendations: analysis.stakingRecommendations.length.toString(),
          recommendedStakingAmount: analysis.stakingRecommendations.reduce((sum, rec) => 
            sum + parseFloat(rec.recommendedAmount), 0
          ).toString(),
          riskScore: analysis.riskProfile.riskScore.toString(),
          diversificationScore: analysis.diversificationScore.toString(),
          analysis: JSON.stringify(analysis)
        },
      };
    } catch (error) {
      elizaLogger.error(`❌ Provider error:`, error);
      throw error;
    }
  }

  async analyzeWallet(runtime: IAgentRuntime, address: string): Promise<WalletAnalysis> {
    const cached = this.cache.get(address);
    if (cached) {
      elizaLogger.info(`📋 Using cached analysis for ${address}`);
      return cached;
    }

    elizaLogger.info(`🔍 Analyzing wallet with staking recommendations: ${address}`);
    
    try {
      const analysis = await this.performComprehensiveAnalysisWithStaking(runtime, address);
      this.cache.set(address, analysis);
      elizaLogger.info(`✅ Comprehensive wallet analysis with staking completed for ${address}`);
      
      return analysis;
    } catch (error) {
      elizaLogger.error(`❌ Error analyzing wallet ${address}:`, error);
      throw new Error(`Failed to analyze wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async performComprehensiveAnalysisWithStaking(runtime: IAgentRuntime, address: string): Promise<WalletAnalysis> {
    try {
      // Check if EVM plugin is available and wallet provider can be initialized
      if (!initWalletProvider) {
        elizaLogger.warn("EVM plugin not available, performing fallback analysis");
        return this.performFallbackAnalysis(address);
      }

      // Validate runtime has required EVM configuration
      if (!this.validateEvmConfiguration(runtime)) {
        elizaLogger.warn("Invalid EVM configuration, performing fallback analysis");
        return this.performFallbackAnalysis(address);
      }

      let walletProvider;
      try {
        // Pre-validate and fix the private key format before initialization
        const evmPrivateKey = runtime.getSetting("EVM_PRIVATE_KEY");
        if (evmPrivateKey) {
          const normalizedKey = this.normalizePrivateKey(evmPrivateKey);
          if (normalizedKey) {
            // Temporarily set the normalized key
            runtime.setSetting("EVM_PRIVATE_KEY", normalizedKey);
          }
        }
        
        walletProvider = await initWalletProvider(runtime);
        elizaLogger.info("✅ Wallet provider initialized successfully");
      } catch (error) {
        elizaLogger.warn("Failed to initialize wallet provider, performing fallback analysis:", error);
        // Log more details about the private key format for debugging
        const evmPrivateKey = runtime.getSetting("EVM_PRIVATE_KEY");
        if (evmPrivateKey) {
          elizaLogger.debug(`Private key length: ${evmPrivateKey.length}`);
          elizaLogger.debug(`Private key starts with 0x: ${evmPrivateKey.startsWith('0x')}`);
        }
        return this.performFallbackAnalysis(address);
      }

      const isOwnWallet = address.toLowerCase() === walletProvider.getAddress().toLowerCase();
      
      // Get native and token balances
      let walletData;
      try {
        walletData = await evmWalletProvider.get(runtime, {} as Memory);
      } catch (error) {
        elizaLogger.warn("Failed to get wallet data from evmWalletProvider:", error);
        return this.performFallbackAnalysis(address);
      }

      const tokenBalances = await this.tokenBalanceProvider.getTokenBalances(
        walletProvider, 
        address as Address
      );

      // Extract and enrich token holdings with staking info
      const allTokenHoldings = tokenBalances.flatMap(chain => chain.tokenHoldings);
      
      // Get native balances and add ETH staking options
      const nativeBalances: Record<string, string> = {};
      tokenBalances.forEach(chain => {
        nativeBalances[chain.chainName] = chain.nativeBalance;
      });

      const totalNativeBalance = Object.values(nativeBalances)
        .reduce((sum, balance) => sum + parseFloat(balance), 0);

      // Identify current staking positions
      const currentStakingPositions = allTokenHoldings.filter(token => 
        ['stETH', 'rETH', 'cbETH', 'sfrxETH'].includes(token.symbol)
      );

      // Perform comprehensive analysis
      const tokenAnalysis = this.analyzeTokenHoldings(allTokenHoldings);
      const diversificationScore = this.calculateDiversificationScore(allTokenHoldings, nativeBalances);
      const riskProfile = this.assessComprehensiveRisk(totalNativeBalance, allTokenHoldings, tokenAnalysis);
      const behaviorPatterns = this.inferBehaviorFromHoldings(allTokenHoldings, tokenBalances);
      const preferredAssets = this.analyzeAssetPreferences(allTokenHoldings, nativeBalances);
      const liquidityNeeds = this.assessLiquidityProfile(allTokenHoldings, totalNativeBalance);

      // Generate staking strategy and recommendations
      const stakingStrategy = this.generateStakingStrategy(riskProfile, liquidityNeeds, totalNativeBalance);
      const stakingRecommendations = this.generateStakingRecommendations(
        nativeBalances,
        allTokenHoldings,
        stakingStrategy,
        riskProfile
      );

      return {
        address,
        totalBalance: totalNativeBalance.toString(),
        portfolioValue: totalNativeBalance.toString(),
        transactionCount: 0,
        tokenHoldings: allTokenHoldings,
        nativeBalances,
        totalUsdValue: 0,
        diversificationScore,
        stakingRecommendations,
        currentStakingPositions,
        tokenAnalysis,
        riskProfile,
        stakingStrategy,
        behaviorPatterns,
        preferredAssets,
        liquidityNeeds,
        evmCapabilities: this.getEVMCapabilities(walletProvider),
      };
      
    } catch (error) {
      elizaLogger.warn("Comprehensive analysis failed, falling back to basic analysis", error);
      return this.performFallbackAnalysis(address);
    }
  }

  // New method to validate and fix EVM configuration
  private validateEvmConfiguration(runtime: IAgentRuntime): boolean {
    try {
      // Check if runtime has the required EVM settings
      const evmPrivateKey = runtime.getSetting("EVM_PRIVATE_KEY");
      
      if (!evmPrivateKey) {
        elizaLogger.warn("EVM_PRIVATE_KEY not found in runtime settings");
        return false;
      }

      // Validate and potentially fix private key format
      const fixedKey = this.normalizePrivateKey(evmPrivateKey);
      if (!fixedKey) {
        elizaLogger.warn("Invalid EVM_PRIVATE_KEY format");
        return false;
      }

      // Update the runtime setting with the properly formatted key
      runtime.setSetting("EVM_PRIVATE_KEY", fixedKey);
      
      return true;
    } catch (error) {
      elizaLogger.warn("Error validating EVM configuration:", error);
      return false;
    }
  }

  // Helper method to normalize private key to proper hex format
  private normalizePrivateKey(privateKey: string): string | null {
    try {
      // Remove any whitespace
      let cleanKey = privateKey.trim();
      
      // Remove 0x prefix if present
      if (cleanKey.startsWith('0x')) {
        cleanKey = cleanKey.slice(2);
      }
      
      // Check if it's a valid hex string of correct length (64 characters = 32 bytes)
      if (cleanKey.length !== 64) {
        elizaLogger.warn(`Private key has invalid length: ${cleanKey.length}, expected 64`);
        return null;
      }
      
      // Check if it's valid hex
      const hexRegex = /^[0-9a-fA-F]+$/;
      if (!hexRegex.test(cleanKey)) {
        elizaLogger.warn("Private key contains invalid hex characters");
        return null;
      }

      // Return with 0x prefix for viem compatibility
      return `0x${cleanKey}`;
    } catch (error) {
      elizaLogger.warn("Error normalizing private key:", error);
      return null;
    }
  }

  // Alternative method to convert string private key to bytes if needed
  private privateKeyToBytes(privateKey: string): Uint8Array | null {
    try {
      const normalizedKey = this.normalizePrivateKey(privateKey);
      if (!normalizedKey) return null;
      
      // Remove 0x prefix and convert hex to bytes
      const hexKey = normalizedKey.slice(2);
      const bytes = new Uint8Array(32);
      
      for (let i = 0; i < 32; i++) {
        bytes[i] = parseInt(hexKey.substr(i * 2, 2), 16);
      }
      
      return bytes;
    } catch (error) {
      elizaLogger.warn("Error converting private key to bytes:", error);
      return null;
    }
  }

  // Helper method to validate private key format
  private isValidPrivateKey(privateKey: string): boolean {
    try {
      // Remove 0x prefix if present
      const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
      
      // Check if it's a valid hex string of correct length (64 characters = 32 bytes)
      if (cleanKey.length !== 64) {
        return false;
      }
      
      // Check if it's valid hex
      const hexRegex = /^[0-9a-fA-F]+$/;
      return hexRegex.test(cleanKey);
    } catch (error) {
      return false;
    }
  }

  private generateStakingStrategy(
    riskProfile: WalletRiskProfile, 
    liquidityNeeds: LiquidityProfile,
    totalBalance: number
  ): StakingStrategy {
    
    let recommendedAllocation = 0;
    let preferredProtocols: string[] = [];
    let stakingHorizon = 365;
    let diversificationGoal = 2;

    // Determine allocation based on risk profile
    switch (riskProfile.riskTolerance) {
      case 'CONSERVATIVE':
        recommendedAllocation = Math.min(40, (1 - liquidityNeeds.liquidityRatio) * 60);
        preferredProtocols = ['Lido', 'Coinbase Wrapped Staked ETH'];
        stakingHorizon = 180;
        diversificationGoal = 1;
        break;
      case 'MODERATE':
        recommendedAllocation = Math.min(60, (1 - liquidityNeeds.liquidityRatio) * 70);
        preferredProtocols = ['Lido', 'Rocket Pool', 'Aave'];
        stakingHorizon = 365;
        diversificationGoal = 2;
        break;
      case 'AGGRESSIVE':
        recommendedAllocation = Math.min(80, (1 - liquidityNeeds.liquidityRatio) * 85);
        preferredProtocols = ['Lido', 'Rocket Pool', 'EigenLayer', 'Aave'];
        stakingHorizon = 730;
        diversificationGoal = 3;
        break;
      case 'DEGENERATE':
        recommendedAllocation = Math.min(90, (1 - liquidityNeeds.liquidityRatio) * 95);
        preferredProtocols = ['EigenLayer', 'Rocket Pool', 'Radiant', 'Moonwell'];
        stakingHorizon = 1095;
        diversificationGoal = 4;
        break;
      default:
        recommendedAllocation = 30;
        preferredProtocols = ['Lido'];
    }

    // Adjust for portfolio size
    if (totalBalance < 1) {
      recommendedAllocation = Math.max(recommendedAllocation - 20, 10);
    } else if (totalBalance > 50) {
      recommendedAllocation = Math.min(recommendedAllocation + 10, 90);
    }

    return {
      recommendedAllocation,
      preferredProtocols,
      riskTolerance: riskProfile.riskTolerance || 'MODERATE',
      liquidityBuffer: liquidityNeeds.liquidityRatio * 100,
      stakingHorizon,
      diversificationGoal
    };
  }

  private generateStakingRecommendations(
    nativeBalances: Record<string, string>,
    tokenHoldings: TokenHolding[],
    strategy: StakingStrategy,
    riskProfile: WalletRiskProfile
  ): StakingRecommendation[] {
    
    const recommendations: StakingRecommendation[] = [];

    // ETH Staking Recommendations
    const ethBalance = parseFloat(nativeBalances.mainnet || '0');
    if (ethBalance > 0.1) {
      const recommendedEthAmount = ethBalance * (strategy.recommendedAllocation / 100);
      
      if (recommendedEthAmount > 0.01) {
        const ethOptions = InternalTokenBalanceProvider.ETH_STAKING_OPTIONS.filter(option => {
          if (strategy.riskTolerance === 'CONSERVATIVE') return option.riskLevel === 'LOW';
          if (strategy.riskTolerance === 'MODERATE') return option.riskLevel !== 'HIGH';
          return true; // HIGH risk tolerance accepts all
        });

        recommendations.push({
          recommendedAmount: recommendedEthAmount.toFixed(9),
          token: 'ETH',
          options: ethOptions,
          reasoning: `Based on your ${riskProfile.riskTolerance.toLowerCase()} risk profile and ${ethBalance.toFixed(2)} ETH balance, staking ${recommendedEthAmount.toFixed(9)} ETH can generate steady yield.`,
          riskAssessment: `${strategy.riskTolerance} risk tolerance suggests ${ethOptions[0]?.protocol || 'liquid staking'} protocols.`,
          expectedReturn: `${(recommendedEthAmount * (ethOptions[0]?.expectedApr || 3.2) / 100).toFixed(9)} ETH annually`,
          priority: ethBalance > 5 ? "HIGH" : ethBalance > 1 ? "MEDIUM" : "LOW"
        });
      }
    }

    // Token Staking Recommendations
    const stakeableTokens = tokenHoldings.filter(token => token.isStakeable && token.stakingOptions?.length);
    
    for (const token of stakeableTokens) {
      const balance = parseFloat(token.balance);
      const minStakeAmount = parseFloat(token.stakingOptions?.[0]?.minAmount || '0');
      
      if (balance > minStakeAmount && balance > 10) { // Only recommend for meaningful amounts
        const recommendedAmount = balance * 0.7; // Conservative 70% recommendation
        
        const suitableOptions = token.stakingOptions?.filter(option => {
          if (strategy.riskTolerance === 'CONSERVATIVE') return option.riskLevel === 'LOW';
          if (strategy.riskTolerance === 'MODERATE') return option.riskLevel !== 'HIGH';
          return true;
        }) || [];

        if (suitableOptions.length > 0) {
          recommendations.push({
            recommendedAmount: recommendedAmount.toFixed(2),
            token: token.symbol,
            options: suitableOptions,
            reasoning: `Your ${token.balance} ${token.symbol} holding can earn yield through lending protocols. Recommended allocation maintains liquidity buffer.`,
            riskAssessment: `${suitableOptions[0].riskLevel} risk ${suitableOptions[0].type.toLowerCase()} staking option.`,
            expectedReturn: `${(recommendedAmount * (suitableOptions[0].expectedApr / 100)).toFixed(2)} ${token.symbol} annually`,
            priority: balance > 1000 ? "HIGH" : balance > 100 ? "MEDIUM" : "LOW"
          });
        }
      }
    }

    // Sort by priority and expected returns
    return recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private analyzeTokenHoldings(tokenHoldings: TokenHolding[]): TokenAnalysis {
    const stablecoins = tokenHoldings.filter(token => 
      ['USDC', 'USDT', 'DAI', 'BUSD', 'FRAX'].includes(token.symbol)
    );
    
    const defiTokens = tokenHoldings.filter(token => 
      ['UNI', 'SUSHI', 'AAVE', 'COMP', 'CRV', 'YFI', 'stETH'].includes(token.symbol)
    );
    
    const governanceTokens = tokenHoldings.filter(token => 
      ['UNI', 'COMP', 'AAVE', 'YFI', 'MKR'].includes(token.symbol)
    );

    const stakeableAssets = tokenHoldings.filter(token => token.isStakeable);

    // Sort by balance to find major holdings
    const sortedHoldings = [...tokenHoldings].sort((a, b) => 
      parseFloat(b.balance) - parseFloat(a.balance)
    );
    
    const majorHoldings = sortedHoldings.slice(0, 5);
    
    // Calculate concentration risk (Herfindahl index)
    const totalValue = tokenHoldings.reduce((sum, token) => sum + parseFloat(token.balance), 0);
    const concentrationRisk = tokenHoldings.reduce((risk, token) => {
      const share = parseFloat(token.balance) / totalValue;
      return risk + (share * share);
    }, 0);

    const diversificationLevel = concentrationRisk > 0.5 ? "LOW" : 
                                concentrationRisk > 0.25 ? "MEDIUM" : "HIGH";

    return {
      totalTokens: tokenHoldings.length,
      majorHoldings,
      stablecoins,
      defiTokens,
      governanceTokens,
      stakeableAssets,
      concentrationRisk,
      diversificationLevel,
    };
  }

  private calculateDiversificationScore(tokenHoldings: TokenHolding[], nativeBalances: Record<string, string>): number {
    const totalAssets = tokenHoldings.length + Object.keys(nativeBalances).length;
    const chainCount = Object.keys(nativeBalances).length;
    
    // Base score from number of assets
    let score = Math.min(totalAssets * 5, 50);
    
    // Bonus for multi-chain presence
    score += Math.min(chainCount * 10, 30);
    
    // Bonus for token type diversity
    const tokenTypes = new Set(tokenHoldings.map(token => {
      if (['USDC', 'USDT', 'DAI'].includes(token.symbol)) return 'stablecoin';
      if (['UNI', 'SUSHI', 'AAVE'].includes(token.symbol)) return 'defi';
      return 'other';
    }));
    
    score += tokenTypes.size * 5;
    
    return Math.min(score, 100);
  }

  private assessComprehensiveRisk(
    nativeBalance: number, 
    tokenHoldings: TokenHolding[], 
    tokenAnalysis: TokenAnalysis
  ): WalletRiskProfile {
    let riskScore = 50; // Base score

    // Adjust for total portfolio size
    if (nativeBalance + tokenHoldings.length > 100) riskScore += 15;
    else if (nativeBalance + tokenHoldings.length > 10) riskScore += 10;
    else if (nativeBalance + tokenHoldings.length < 1) riskScore -= 15;

    // Adjust for token diversity
    riskScore += Math.min(tokenHoldings.length * 2, 20);

    // Adjust for stablecoin allocation
    const stablecoinRatio = tokenAnalysis.stablecoins.length / Math.max(tokenHoldings.length, 1);
    if (stablecoinRatio > 0.5) riskScore -= 10;
    else if (stablecoinRatio < 0.1) riskScore += 10;

    // Concentration risk penalty
    if (tokenAnalysis.concentrationRisk > 0.5) riskScore += 15;
    
    riskScore = Math.max(0, Math.min(100, riskScore));

    // Determine staking risk tolerance
    let stakingRiskTolerance: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";
    if (riskScore < 30) stakingRiskTolerance = "LOW";
    else if (riskScore > 70) stakingRiskTolerance = "HIGH";

    return {
      riskScore,
      riskTolerance: this.mapRiskScoreToTolerance(riskScore),
      maxSinglePosition: (nativeBalance * this.getMaxPositionRatio(riskScore)).toString(),
      diversificationLevel: tokenAnalysis.diversificationLevel,
      lockPeriodTolerance: this.calculateLockPeriodTolerance(riskScore),
      concentrationRisk: tokenAnalysis.concentrationRisk,
      liquidityRisk: this.calculateLiquidityRisk(tokenHoldings),
      stakingRiskTolerance
    };
  }

  private calculateLiquidityRisk(tokenHoldings: TokenHolding[]): number {
    const liquidTokens = tokenHoldings.filter(token => 
      ['USDC', 'USDT', 'DAI', 'WETH', 'UNI'].includes(token.symbol)
    ).length;
    
    const totalTokens = tokenHoldings.length;
    return totalTokens > 0 ? 1 - (liquidTokens / totalTokens) : 0;
  }

  private inferBehaviorFromHoldings(tokenHoldings: TokenHolding[], tokenBalances: TokenBalanceData[]): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];

    // Multi-chain behavior
    if (tokenBalances.length > 2) {
      patterns.push({
        pattern: "Multi-Chain Power User",
        frequency: tokenBalances.length,
        confidence: 0.9,
        description: `Active across ${tokenBalances.length} different chains`,
        stakingImplication: "Consider multi-chain staking strategies for optimal yields"
      });
    }

    // DeFi behavior
    const defiTokens = tokenHoldings.filter(token => 
      ['UNI', 'SUSHI', 'AAVE', 'COMP', 'CRV', 'stETH'].includes(token.symbol)
    );
    
    if (defiTokens.length > 2) {
      patterns.push({
        pattern: "DeFi Enthusiast",
        frequency: defiTokens.length,
        confidence: 0.8,
        description: `Holds ${defiTokens.length} different DeFi protocol tokens`,
        stakingImplication: "High comfort with DeFi protocols, suitable for advanced staking strategies"
      });
    }

    // Stablecoin strategy
    const stablecoins = tokenHoldings.filter(token => 
      ['USDC', 'USDT', 'DAI'].includes(token.symbol)
    );
    
    if (stablecoins.length >= 2) {
      patterns.push({
        pattern: "Stablecoin Diversifier",
        frequency: stablecoins.length,
        confidence: 0.7,
        description: `Maintains ${stablecoins.length} different stablecoin positions`,
        stakingImplication: "Excellent candidate for stablecoin lending strategies"
      });
    }

    // Governance participation
    const govTokens = tokenHoldings.filter(token => 
      ['UNI', 'COMP', 'AAVE', 'YFI'].includes(token.symbol)
    );
    
    if (govTokens.length > 1) {
      patterns.push({
        pattern: "Governance Participant",
        frequency: govTokens.length,
        confidence: 0.6,
        description: `Holds governance tokens for ${govTokens.length} protocols`,
        stakingImplication: "Active in governance, may prefer protocols with voting rewards"
      });
    }

    return patterns;
  }

  private analyzeAssetPreferences(tokenHoldings: TokenHolding[], nativeBalances: Record<string, string>): AssetPreference[] {
    const preferences: AssetPreference[] = [];

    // Native token preferences
    Object.entries(nativeBalances).forEach(([chain, balance]) => {
      if (parseFloat(balance) > 0.01) {
        preferences.push({
          token: `${chain.toUpperCase()}_ETH`,
          preference: Math.min(parseFloat(balance) / 10, 1),
          volume: balance,
          type: "NATIVE",
          stakingPotential: parseFloat(balance) > 0.1 ? 0.9 : 0.5
        });
      }
    });

    // ERC-20 token preferences
    tokenHoldings.forEach(token => {
      let type: "ERC20" | "STABLECOIN" | "DEFI" = "ERC20";
      let stakingPotential = 0.3;
      
      if (['USDC', 'USDT', 'DAI'].includes(token.symbol)) {
        type = "STABLECOIN";
        stakingPotential = token.isStakeable ? 0.8 : 0.2;
      } else if (['UNI', 'SUSHI', 'AAVE', 'stETH'].includes(token.symbol)) {
        type = "DEFI";
        stakingPotential = token.isStakeable ? 0.7 : 0.4;
      }

      preferences.push({
        token: token.symbol,
        preference: Math.min(parseFloat(token.balance) / 1000, 1),
        volume: token.balance,
        type,
        stakingPotential
      });
    });

    return preferences.sort((a, b) => b.preference - a.preference);
  }

  private assessLiquidityProfile(tokenHoldings: TokenHolding[], nativeBalance: number): LiquidityProfile {
    const liquidTokens = tokenHoldings.filter(token => 
      ['USDC', 'USDT', 'DAI', 'WETH'].includes(token.symbol)
    );

    const stakedTokens = tokenHoldings.filter(token => 
      ['stETH', 'rETH', 'cbETH'].includes(token.symbol)
    );

    const totalValue = nativeBalance + tokenHoldings.reduce((sum, token) => 
      sum + parseFloat(token.balance), 0
    );

    const liquidityRatio = liquidTokens.length / Math.max(tokenHoldings.length, 1);

    // Calculate staking capacity (how much can be safely staked)
    const stakingCapacity = Math.max(0, totalValue * (1 - Math.max(liquidityRatio, 0.2)));

    return {
      liquidityRatio,
      withdrawalFrequency: liquidityRatio > 0.5 ? 4 : 1, // Monthly vs quarterly
      emergencyBuffer: totalValue * 0.1,
      preferredLockPeriods: liquidityRatio > 0.3 ? [0, 7, 30] : [30, 90, 365],
      liquidAssets: liquidTokens,
      stakedAssets: stakedTokens,
      stakingCapacity
    };
  }

  private getEVMCapabilities(walletProvider: any): EVMCapabilities {
    return {
      canTransfer: true,
      canBridge: true,
      canSwap: true,
      canStake: true,
      supportedChains: walletProvider.getSupportedChains(),
      preferredDEXs: ["uniswap", "sushiswap", "1inch"],
      stakingProtocols: ["lido", "rocketpool", "aave", "compound", "eigenlayer"]
    };
  }

  private performFallbackAnalysis(address: string): WalletAnalysis {
    return {
      address,
      totalBalance: "0",
      portfolioValue: "0",
      transactionCount: 0,
      tokenHoldings: [],
      nativeBalances: {},
      totalUsdValue: 0,
      diversificationScore: 0,
      stakingRecommendations: [],
      currentStakingPositions: [],
      tokenAnalysis: {
        totalTokens: 0,
        majorHoldings: [],
        stablecoins: [],
        defiTokens: [],
        governanceTokens: [],
        stakeableAssets: [],
        concentrationRisk: 0,
        diversificationLevel: "LOW"
      },
      riskProfile: {
        riskScore: 0,
        riskTolerance: "UNKNOWN",
        maxSinglePosition: "0",
        diversificationLevel: "UNKNOWN",
        lockPeriodTolerance: 0,
        concentrationRisk: 0,
        liquidityRisk: 0,
        stakingRiskTolerance: "LOW"
      },
      stakingStrategy: {
        recommendedAllocation: 0,
        preferredProtocols: [],
        riskTolerance: "CONSERVATIVE",
        liquidityBuffer: 50,
        stakingHorizon: 180,
        diversificationGoal: 1
      },
      behaviorPatterns: [],
      preferredAssets: [],
      liquidityNeeds: {
        liquidityRatio: 1,
        withdrawalFrequency: 12,
        emergencyBuffer: 0,
        preferredLockPeriods: [0],
        liquidAssets: [],
        stakedAssets: [],
        stakingCapacity: 0
      },
      evmCapabilities: {
        canTransfer: false,
        canBridge: false,
        canSwap: false,
        canStake: false,
        supportedChains: [],
        preferredDEXs: [],
        stakingProtocols: []
      }
    };
  }

  private formatAnalysisWithStaking(analysis: WalletAnalysis, agentName: string): string {
    let text = `${agentName}'s Comprehensive Wallet Analysis & Staking Strategy for ${analysis.address}:\n\n`;
    
    // Portfolio Overview
    text += `📊 PORTFOLIO OVERVIEW:\n`;
    text += `Total Native Balance: ${analysis.totalBalance} ETH\n`;
    text += `Token Holdings: ${analysis.tokenHoldings.length} tokens\n`;
    text += `Active Chains: ${Object.keys(analysis.nativeBalances).length}\n`;
    text += `Diversification Score: ${analysis.diversificationScore}/100\n`;
    text += `Current Staking Positions: ${analysis.currentStakingPositions.length}\n\n`;
    
    // Staking Strategy
    text += `🎯 PERSONALIZED STAKING STRATEGY:\n`;
    text += `Recommended Allocation: ${analysis.stakingStrategy.recommendedAllocation}% of portfolio\n`;
    text += `Risk Tolerance: ${analysis.stakingStrategy.riskTolerance}\n`;
    text += `Liquidity Buffer: ${analysis.stakingStrategy.liquidityBuffer}%\n`;
    text += `Staking Horizon: ${analysis.stakingStrategy.stakingHorizon} days\n`;
    text += `Preferred Protocols: ${analysis.stakingStrategy.preferredProtocols.join(', ')}\n\n`;
    
    // Staking Recommendations
    if (analysis.stakingRecommendations.length > 0) {
      text += `💰 STAKING RECOMMENDATIONS:\n`;
      analysis.stakingRecommendations.forEach((rec, index) => {
        text += `\n${index + 1}. ${rec.token} Staking (${rec.priority} Priority):\n`;
        text += `   💵 Amount: ${rec.recommendedAmount} ${rec.token}\n`;
        text += `   📈 Expected Return: ${rec.expectedReturn}\n`;
        text += `   🎲 Risk: ${rec.riskAssessment}\n`;
        text += `   💡 Reasoning: ${rec.reasoning}\n`;
        
        if (rec.options.length > 0) {
          text += `   🏛️ Top Protocol: ${rec.options[0].protocol} (${rec.options[0].expectedApr}% APR)\n`;
          text += `   📋 Description: ${rec.options[0].description}\n`;
        }
      });
      text += '\n';
    }
    
    // Current Staking Analysis
    if (analysis.currentStakingPositions.length > 0) {
      text += `🔒 CURRENT STAKING POSITIONS:\n`;
      analysis.currentStakingPositions.forEach(position => {
        text += `• ${position.symbol}: ${position.balance} (${position.chainName})\n`;
      });
      text += '\n';
    }
    
    // Token Analysis with Staking Focus
    if (analysis.tokenAnalysis.stakeableAssets.length > 0) {
      text += `🪙 STAKEABLE ASSETS ANALYSIS:\n`;
      text += `Total Stakeable Tokens: ${analysis.tokenAnalysis.stakeableAssets.length}\n`;
      text += `Stablecoins Ready for Lending: ${analysis.tokenAnalysis.stablecoins.filter(t => t.isStakeable).length}\n`;
      text += `DeFi Tokens with Staking: ${analysis.tokenAnalysis.defiTokens.filter(t => t.isStakeable).length}\n\n`;
    }
    
    // Risk Profile
    text += `⚠️ RISK PROFILE:\n`;
    text += `Overall Risk Score: ${analysis.riskProfile.riskScore}/100\n`;
    text += `Risk Tolerance: ${analysis.riskProfile.riskTolerance}\n`;
    text += `Staking Risk Tolerance: ${analysis.riskProfile.stakingRiskTolerance}\n`;
    text += `Concentration Risk: ${(analysis.riskProfile.concentrationRisk * 100).toFixed(1)}%\n`;
    text += `Liquidity Risk: ${(analysis.riskProfile.liquidityRisk * 100).toFixed(1)}%\n\n`;
    
    // Liquidity & Staking Capacity
    text += `💧 LIQUIDITY & STAKING CAPACITY:\n`;
    text += `Current Liquidity Ratio: ${(analysis.liquidityNeeds.liquidityRatio * 100).toFixed(1)}%\n`;
    text += `Staking Capacity: ${analysis.liquidityNeeds.stakingCapacity.toFixed(9)} ETH equivalent\n`;
    text += `Emergency Buffer: ${analysis.liquidityNeeds.emergencyBuffer.toFixed(9)} ETH\n`;
    text += `Liquid Assets: ${analysis.liquidityNeeds.liquidAssets.length}\n`;
    text += `Already Staked: ${analysis.liquidityNeeds.stakedAssets.length}\n\n`;
    
    // Behavior Patterns with Staking Implications
    if (analysis.behaviorPatterns.length > 0) {
      text += `🎯 BEHAVIOR PATTERNS & STAKING IMPLICATIONS:\n`;
      analysis.behaviorPatterns.forEach(pattern => {
        text += `• ${pattern.pattern}: ${pattern.description}\n`;
        if (pattern.stakingImplication) {
          text += `  💡 Staking Implication: ${pattern.stakingImplication}\n`;
        }
      });
      text += '\n';
    }
    
    // EVM Capabilities
    text += `⚡ STAKING CAPABILITIES:\n`;
    text += `Supported Chains: ${analysis.evmCapabilities.supportedChains.join(', ')}\n`;
    text += `Available Staking Protocols: ${analysis.evmCapabilities.stakingProtocols.join(', ')}\n`;
    text += `Can Stake: ${analysis.evmCapabilities.canStake ? '✅' : '❌'}\n`;
    text += `Can Bridge for Better Yields: ${analysis.evmCapabilities.canBridge ? '✅' : '❌'}\n\n`;

    // Action Items
    text += `📋 NEXT STEPS:\n`;
    const topRecommendation = analysis.stakingRecommendations[0];
    if (topRecommendation) {
      text += `1. Start with ${topRecommendation.token} staking: ${topRecommendation.recommendedAmount} ${topRecommendation.token}\n`;
      text += `2. Use ${topRecommendation.options[0]?.protocol || 'recommended protocol'} for ${topRecommendation.options[0]?.expectedApr || 'competitive'} APR\n`;
      text += `3. Monitor liquidity needs and adjust allocation as needed\n`;
      text += `4. Consider diversifying across ${analysis.stakingStrategy.diversificationGoal} protocols for optimal risk/reward\n`;
    } else {
      text += `1. Build up ETH balance to 0.1+ for liquid staking opportunities\n`;
      text += `2. Consider accumulating stablecoins for lending yield\n`;
      text += `3. Explore DeFi protocols on your active chains\n`;
    }
    
    return text;
  }

  private mapRiskScoreToTolerance(score: number): "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "DEGENERATE" {
    if (score < 25) return "CONSERVATIVE";
    if (score < 50) return "MODERATE";
    if (score < 75) return "AGGRESSIVE";
    return "DEGENERATE";
  }

  private getMaxPositionRatio(riskScore: number): number {
    if (riskScore < 25) return 0.1;
    if (riskScore < 50) return 0.2;
    if (riskScore < 75) return 0.4;
    return 0.6;
  }

  private calculateLockPeriodTolerance(riskScore: number): number {
    if (riskScore < 25) return 7;   // Conservative: max 1 week
    if (riskScore < 50) return 30;  // Moderate: max 1 month
    if (riskScore < 75) return 90;  // Aggressive: max 3 months
    return 365; // Degenerate: up to 1 year
  }
}