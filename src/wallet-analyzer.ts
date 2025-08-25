import {
  type Address,
  type Chain,
  formatUnits,
  parseAbi,
  createPublicClient,
  http,
} from "viem";

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
    console.warn(
      "@elizaos/plugin-evm not available, using fallback mode",
      error
    );
    return {
      evmWalletProvider: null,
      initWalletProvider: null,
      WalletProvider: null,
    };
  }
}

// Usage
const { evmWalletProvider, initWalletProvider, WalletProvider } =
  await initializeEvmPlugin();

import {
  type IAgentRuntime,
  type Memory,
  type Provider,
  type ProviderResult,
  type State,
  elizaLogger,
} from "@elizaos/core";

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
  isTestnet?: boolean;
}

export interface TokenBalanceData {
  address: string;
  chainName: string;
  nativeBalance: string;
  tokenHoldings: TokenHolding[];
  totalUsdValue: number;
  isTestnet?: boolean;
}

// Extended type definitions for comprehensive analysis

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
  isTestnet?: boolean;
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
  riskTolerance:
    | "CONSERVATIVE"
    | "MODERATE"
    | "AGGRESSIVE"
    | "DEGENERATE"
    | "UNKNOWN";
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
  riskTolerance:
    | "CONSERVATIVE"
    | "MODERATE"
    | "AGGRESSIVE"
    | "DEGENERATE"
    | "UNKNOWN";
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

  //Comprehensive chain configuration with proper RPC endpoints
  public static readonly CHAIN_CONFIG = {
    // Mainnets
    mainnet: {
      id: 1,
      name: "Ethereum",
      rpcUrl: "https://eth.llamarpc.com",
      isTestnet: false,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    },
    base: {
      id: 8453,
      name: "Base",
      rpcUrl: "https://mainnet.base.org",
      isTestnet: false,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    },
    arbitrum: {
      id: 42161,
      name: "Arbitrum One",
      rpcUrl: "https://arb1.arbitrum.io/rpc",
      isTestnet: false,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    },
    polygon: {
      id: 137,
      name: "Polygon",
      rpcUrl: "https://polygon-rpc.com",
      isTestnet: false,
      nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    },
    //Testnets
    sepolia: {
      id: 11155111,
      name: "Sepolia",
      rpcUrl: "https://rpc.sepolia.org",
      fallbackRpcUrls: [
        "https://ethereum-sepolia-rpc.publicnode.com",
        "https://rpc2.sepolia.org",
        "https://sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161", // Use your Infura key
      ],
      isTestnet: true,
      nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    },

   
    holesky: {
      id: 17000,
      name: "Holesky",
      rpcUrl: "https://ethereum-holesky-rpc.publicnode.com",
      fallbackRpcUrls: [
        "https://holesky.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
        "https://rpc.holesky.ethpandaops.io",
      ],
      isTestnet: true,
      nativeCurrency: { name: "Holesky Ether", symbol: "ETH", decimals: 18 },
    },

    baseSepolia: {
      id: 84532,
      name: "Base Sepolia",
      rpcUrl: "https://sepolia.base.org",
      fallbackRpcUrls: [
        "https://base-sepolia-rpc.publicnode.com",
        "https://base-sepolia.gateway.tenderly.co",
        "https://base-sepolia.blockpi.network/v1/rpc/public",
      ],
      isTestnet: true,
      nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    },

    arbitrumSepolia: {
      id: 421614,
      name: "Arbitrum Sepolia",
      rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
      fallbackRpcUrls: [
        "https://arbitrum-sepolia-rpc.publicnode.com",
        "https://arbitrum-sepolia.gateway.tenderly.co",
        "https://arbitrum-sepolia.blockpi.network/v1/rpc/public",
      ],
      isTestnet: true,
      nativeCurrency: {
        name: "Arbitrum Sepolia Ether",
        symbol: "ETH",
        decimals: 18,
      },
    },

    polygonAmoy: {
      id: 80002,
      name: "Polygon Amoy",
      rpcUrl: "https://rpc-amoy.polygon.technology",
      fallbackRpcUrls: [
        "https://polygon-amoy-bor-rpc.publicnode.com",
        "https://polygon-amoy.gateway.tenderly.co",
        "https://polygon-amoy.blockpi.network/v1/rpc/public",
      ],
      isTestnet: true,
      nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    },

    optimismSepolia: {
      id: 11155420,
      name: "Optimism Sepolia",
      rpcUrl: "https://sepolia.optimism.io",
      fallbackRpcUrls: [
        "https://optimism-sepolia-rpc.publicnode.com",
        "https://optimism-sepolia.gateway.tenderly.co",
        "https://optimism-sepolia.blockpi.network/v1/rpc/public",
      ],
      isTestnet: true,
      nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    },
  };

  // Enhanced TESTNET_TOKEN_DATABASE
  private static readonly TESTNET_TOKEN_DATABASE = {
    sepolia: [
      {
        address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
        symbol: "UNI",
        name: "Uniswap (Testnet)",
        decimals: 18,
        isStakeable: true,
        isTestnet: true,
        stakingOptions: [
          {
            protocol: "Testnet Uniswap",
            type: "YIELD_FARMING" as const,
            expectedApr: 8.0,
            minAmount: "1",
            riskLevel: "MEDIUM" as const,
            description: "Test UNI/ETH liquidity provision on Uniswap Sepolia",
            chainName: "sepolia",
          },
        ],
      },
      {
        address: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
        symbol: "LINK",
        name: "Chainlink Token (Testnet)",
        decimals: 18,
        isStakeable: true,
        isTestnet: true,
        stakingOptions: [
          {
            protocol: "Testnet Aave",
            type: "LIQUID" as const,
            expectedApr: 5.0,
            minAmount: "1", // Lower minimum
            riskLevel: "LOW" as const,
            description: "Test LINK lending on Aave Sepolia",
            chainName: "sepolia",
          },
          {
            protocol: "Testnet Compound",
            type: "LIQUID" as const,
            expectedApr: 4.2,
            minAmount: "0.5",
            riskLevel: "LOW" as const,
            description: "Test LINK supply on Compound Sepolia",
            chainName: "sepolia",
          },
        ],
      },
      {
        address: "0x6f14C02Fc1F78322cFd7d707ab90f18baD3B54f5",
        symbol: "USDC",
        name: "USD Coin (Testnet)",
        decimals: 6,
        isStakeable: true,
        isTestnet: true,
        stakingOptions: [
          {
            protocol: "Testnet Compound",
            type: "LIQUID" as const,
            expectedApr: 3.5,
            minAmount: "1", // Much lower minimum
            riskLevel: "LOW" as const,
            description: "Test USDC lending on Compound Sepolia",
            chainName: "sepolia",
          },
          {
            protocol: "Testnet Aave",
            type: "LIQUID" as const,
            expectedApr: 4.0,
            minAmount: "1",
            riskLevel: "LOW" as const,
            description: "Test USDC supply on Aave Sepolia",
            chainName: "sepolia",
          },
        ],
      },
      {
        address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
        symbol: "WETH",
        name: "Wrapped Ether (Testnet)",
        decimals: 18,
        isStakeable: true,
        isTestnet: true,
        stakingOptions: [
          {
            protocol: "Testnet Lido",
            type: "LIQUID" as const,
            expectedApr: 2.5,
            minAmount: "0.001", // Very low minimum for testing
            riskLevel: "LOW" as const,
            description: "Test ETH staking on Lido Sepolia",
            chainName: "sepolia",
          },
          {
            protocol: "Testnet Uniswap",
            type: "YIELD_FARMING" as const,
            expectedApr: 6.0,
            minAmount: "0.01",
            riskLevel: "MEDIUM" as const,
            description: "Test WETH/USDC LP on Uniswap Sepolia",
            chainName: "sepolia",
          },
        ],
      },
      {
        address: "0x25a233c2C94b62C3532a0BCA0186cfEfb6908D0A",
        symbol: "DAI",
        name: "Dai Stablecoin (Testnet)",
        decimals: 18,
        isStakeable: true,
        isTestnet: true,
        stakingOptions: [
          {
            protocol: "Testnet MakerDAO",
            type: "LIQUID" as const,
            expectedApr: 4.0,
            minAmount: "1",
            riskLevel: "LOW" as const,
            description: "Test DAI savings rate on Sepolia",
            chainName: "sepolia",
          },
          {
            protocol: "Testnet Aave",
            type: "LIQUID" as const,
            expectedApr: 3.8,
            minAmount: "1",
            riskLevel: "LOW" as const,
            description: "Test DAI lending on Aave Sepolia",
            chainName: "sepolia",
          },
        ],
      },
    ],

    holesky: [
      {
        address: "0x94373a4919B3240D86eA41593D5eBa789FEF3848",
        symbol: "WETH",
        name: "Wrapped Ether (Holesky)",
        decimals: 18,
        isStakeable: true,
        isTestnet: true,
        stakingOptions: [
          {
            protocol: "Holesky Lido",
            type: "LIQUID" as const,
            expectedApr: 2.8,
            minAmount: "0.001",
            riskLevel: "LOW" as const,
            description: "Test ETH liquid staking on Holesky testnet",
            chainName: "holesky",
          },
        ],
      },
    ],

    baseSepolia: [
      {
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        symbol: "USDC",
        name: "USD Coin (Base Sepolia)",
        decimals: 6,
        isStakeable: true,
        isTestnet: true,
        stakingOptions: [
          {
            protocol: "Base Sepolia Moonwell",
            type: "LIQUID" as const,
            expectedApr: 3.2,
            minAmount: "1",
            riskLevel: "MEDIUM" as const,
            description: "Test USDC lending on Moonwell Base Sepolia",
            chainName: "baseSepolia",
          },
        ],
      },
    ],

    arbitrumSepolia: [
      {
        address: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
        symbol: "USDC",
        name: "USD Coin (Arbitrum Sepolia)",
        decimals: 6,
        isStakeable: true,
        isTestnet: true,
        stakingOptions: [
          {
            protocol: "Arbitrum Sepolia Radiant",
            type: "LIQUID" as const,
            expectedApr: 3.8,
            minAmount: "1",
            riskLevel: "MEDIUM" as const,
            description: "Test USDC lending on Radiant Arbitrum Sepolia",
            chainName: "arbitrumSepolia",
          },
        ],
      },
    ],

    polygonAmoy: [
      {
        address: "0x360ad4f9a9A8EFe9A8DCB5f461c4Cc1047E1Dcf9",
        symbol: "WMATIC",
        name: "Wrapped Matic (Amoy)",
        decimals: 18,
        isStakeable: true,
        isTestnet: true,
        stakingOptions: [
          {
            protocol: "Amoy Staking",
            type: "LIQUID" as const,
            expectedApr: 6.0,
            minAmount: "1",
            riskLevel: "MEDIUM" as const,
            description: "Test MATIC staking on Polygon Amoy",
            chainName: "polygonAmoy",
          },
        ],
      },
    ],

    optimismSepolia: [
      {
        address: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
        symbol: "USDC",
        name: "USD Coin (Optimism Sepolia)",
        decimals: 6,
        isStakeable: true,
        isTestnet: true,
        stakingOptions: [
          {
            protocol: "Optimism Sepolia Aave",
            type: "LIQUID" as const,
            expectedApr: 3.5,
            minAmount: "1",
            riskLevel: "LOW" as const,
            description: "Test USDC lending on Aave Optimism Sepolia",
            chainName: "optimismSepolia",
          },
        ],
      },
    ],
  };

  // Comprehensive token database with staking information
  private static readonly TOKEN_DATABASE = {
    mainnet: [
      {
        address: "0xA0b86a33E6Db485E0f65b2f8b4b92c0e7b9c2c1e",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: "Aave",
            type: "LIQUID" as const,
            expectedApr: 4.5,
            minAmount: "100",
            riskLevel: "LOW" as const,
            description: "Lending USDC on Aave for stable yield",
            chainName: "mainnet",
          },
          {
            protocol: "Compound",
            type: "LIQUID" as const,
            expectedApr: 3.8,
            minAmount: "50",
            riskLevel: "LOW" as const,
            description: "Supply USDC to Compound for lending yield",
            chainName: "mainnet",
          },
        ],
      },
      {
        address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        symbol: "USDT",
        name: "Tether USD",
        decimals: 6,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: "Aave",
            type: "LIQUID" as const,
            expectedApr: 4.2,
            minAmount: "100",
            riskLevel: "LOW" as const,
            description: "Lend USDT on Aave for stable returns",
            chainName: "mainnet",
          },
        ],
      },
      {
        address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        symbol: "DAI",
        name: "Dai Stablecoin",
        decimals: 18,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: "MakerDAO DSR",
            type: "LIQUID" as const,
            expectedApr: 5.0,
            minAmount: "1",
            riskLevel: "LOW" as const,
            description: "Earn DAI Savings Rate directly from MakerDAO",
            chainName: "mainnet",
          },
          {
            protocol: "Aave",
            type: "LIQUID" as const,
            expectedApr: 4.3,
            minAmount: "50",
            riskLevel: "LOW" as const,
            description: "Supply DAI to Aave lending pool",
            chainName: "mainnet",
          },
        ],
      },
      {
        address: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",
        symbol: "UNI",
        name: "Uniswap",
        decimals: 18,
        isStakeable: false, // Governance token, no direct staking
      },
      {
        address: "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
        symbol: "stETH",
        name: "Lido Staked Ether",
        decimals: 18,
        isStakeable: false, // Already staked ETH
      },
    ],
    base: [
      {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: "Moonwell",
            type: "LIQUID" as const,
            expectedApr: 3.5,
            minAmount: "50",
            riskLevel: "MEDIUM" as const,
            description: "Supply USDC to Moonwell lending market on Base",
            chainName: "base",
          },
        ],
      },
      {
        address: "0x4200000000000000000000000000000000000006",
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: "Moonwell",
            type: "LIQUID" as const,
            expectedApr: 2.8,
            minAmount: "0.1",
            riskLevel: "MEDIUM" as const,
            description: "Supply WETH to Moonwell for lending yield",
            chainName: "base",
          },
        ],
      },
    ],
    arbitrum: [
      {
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        symbol: "USDC",
        name: "USD Coin",
        decimals: 6,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: "Radiant",
            type: "LIQUID" as const,
            expectedApr: 4.0,
            minAmount: "50",
            riskLevel: "MEDIUM" as const,
            description: "Lend USDC on Radiant Capital for yield",
            chainName: "arbitrum",
          },
        ],
      },
      {
        address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        symbol: "WETH",
        name: "Wrapped Ether",
        decimals: 18,
        isStakeable: true,
        stakingOptions: [
          {
            protocol: "Radiant",
            type: "LIQUID" as const,
            expectedApr: 2.5,
            minAmount: "0.1",
            riskLevel: "MEDIUM" as const,
            description: "Supply WETH to Radiant lending pool",
            chainName: "arbitrum",
          },
        ],
      },
    ],
  };

  // Testnet ETH staking options
  public static readonly TESTNET_ETH_STAKING_OPTIONS: StakingOption[] = [
    {
      protocol: "Testnet Lido",
      type: "LIQUID",
      expectedApr: 2.5,
      minAmount: "0.001", // Much lower minimum
      riskLevel: "LOW",
      description:
        "Test liquid staking with Lido on Sepolia - practice the full staking flow",
      chainName: "sepolia",
    },
    {
      protocol: "Testnet Rocket Pool",
      type: "LIQUID",
      expectedApr: 2.3,
      minAmount: "0.001", // Much lower minimum
      riskLevel: "LOW",
      description:
        "Test decentralized staking on testnet - understand rETH mechanics",
      chainName: "sepolia",
    },
    {
      protocol: "Sepolia Beacon Chain",
      type: "LOCKED",
      expectedApr: 3.0,
      minAmount: "0.1", // Much lower than 32 for testing
      lockPeriod: 1, // Shorter lock for testing
      riskLevel: "MEDIUM",
      description: "Test direct beacon chain staking with minimal amounts",
      chainName: "sepolia",
    },
    {
      protocol: "Testnet Frax",
      type: "LIQUID",
      expectedApr: 2.8,
      minAmount: "0.001",
      riskLevel: "MEDIUM",
      description: "Test Frax ETH liquid staking - learn sfrxETH mechanics",
      chainName: "sepolia",
    },
  ];

  // Helper method to detect if chain is testnet
  public static isTestnetChain(chainName: string): boolean {
    return (
      InternalTokenBalanceProvider.CHAIN_CONFIG[
        chainName as keyof typeof InternalTokenBalanceProvider.CHAIN_CONFIG
      ]?.isTestnet || false
    );
  }

  // Get all testnet chains
  public static getTestnetChains(): string[] {
    return Object.keys(InternalTokenBalanceProvider.CHAIN_CONFIG).filter(
      (chainName) =>
        InternalTokenBalanceProvider.CHAIN_CONFIG[
          chainName as keyof typeof InternalTokenBalanceProvider.CHAIN_CONFIG
        ].isTestnet
    );
  }

  // Get all mainnet chains
  public static getMainnetChains(): string[] {
    return Object.keys(InternalTokenBalanceProvider.CHAIN_CONFIG).filter(
      (chainName) =>
        !InternalTokenBalanceProvider.CHAIN_CONFIG[
          chainName as keyof typeof InternalTokenBalanceProvider.CHAIN_CONFIG
        ].isTestnet
    );
  }

  // Native ETH staking options
  public static readonly ETH_STAKING_OPTIONS: StakingOption[] = [
    {
      protocol: "Lido",
      type: "LIQUID",
      expectedApr: 3.2,
      minAmount: "0.01",
      riskLevel: "LOW",
      description: "Liquid staking with Lido - get stETH tokens",
      chainName: "mainnet",
    },
    {
      protocol: "Rocket Pool",
      type: "LIQUID",
      expectedApr: 3.1,
      minAmount: "0.01",
      riskLevel: "LOW",
      description: "Decentralized liquid staking with Rocket Pool",
      chainName: "mainnet",
    },
    {
      protocol: "Coinbase Wrapped Staked ETH",
      type: "LIQUID",
      expectedApr: 3.0,
      minAmount: "0.001",
      riskLevel: "LOW",
      description: "Coinbase institutional staking solution",
      chainName: "mainnet",
    },
    {
      protocol: "EigenLayer",
      type: "RESTAKING",
      expectedApr: 4.5,
      minAmount: "32",
      lockPeriod: 21,
      riskLevel: "HIGH",
      description: "Restake ETH for additional AVS rewards (higher risk)",
      chainName: "mainnet",
    },
  ];

  // ERC-20 ABI for balance checking
  private static readonly ERC20_ABI = parseAbi([
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function name() view returns (string)",
  ]);

  private createPublicClient(chainName: string) {
    const chainConfig =
      InternalTokenBalanceProvider.CHAIN_CONFIG[
        chainName as keyof typeof InternalTokenBalanceProvider.CHAIN_CONFIG
      ];
    if (!chainConfig) {
      throw new Error(`Unsupported chain: ${chainName}`);
    }

    return createPublicClient({
      transport: http(chainConfig.rpcUrl),
    });
  }

  //Main method to get token balances with proper testnet filtering
  async getTokenBalances(
    walletProvider: any,
    address: Address,
    testnetOnly: boolean = false
  ): Promise<TokenBalanceData[]> {
    const cacheKey = `${address}_token_balances_${testnetOnly ? "testnet" : "all"}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      elizaLogger.info(
        `📋 Using cached token balances for ${address} (testnet: ${testnetOnly})`
      );
      return cached;
    }

    // Determine which chains to check
    let chainsToCheck: string[];
    if (testnetOnly) {
      chainsToCheck = InternalTokenBalanceProvider.getTestnetChains();
      elizaLogger.info(
        `🧪 Checking testnet chains: ${chainsToCheck.join(", ")}`
      );
    } else {
      // For regular analysis, check both mainnet and testnet but prioritize based on what's found
      const supportedChains =
        walletProvider?.getSupportedChains() ||
        Object.keys(InternalTokenBalanceProvider.CHAIN_CONFIG);
      chainsToCheck = supportedChains;
    }

    const tokenBalances: TokenBalanceData[] = [];

    await Promise.all(
      chainsToCheck.map(async (chainName: string) => {
        try {
          const chainData = await this.getTokenBalancesForChain(
            walletProvider,
            address,
            chainName
          );

          // Only include chains with balances or if specifically requesting testnet
          if (
            chainData.tokenHoldings.length > 0 ||
            parseFloat(chainData.nativeBalance) > 0 ||
            testnetOnly
          ) {
            tokenBalances.push(chainData);
          }
        } catch (error) {
          elizaLogger.warn(
            `Failed to get token balances for ${chainName}:`,
            error
          );
        }
      })
    );

    this.cache.set(cacheKey, tokenBalances);
    elizaLogger.info(
      `✅ Retrieved balances from ${tokenBalances.length} chains (testnet mode: ${testnetOnly})`
    );
    return tokenBalances;
  }

  //Enhanced method to get token balances for a specific chain
  private async getTokenBalancesForChain(
    walletProvider: any,
    address: Address,
    chainName: string
  ): Promise<TokenBalanceData> {
    const isTestnet = InternalTokenBalanceProvider.isTestnetChain(chainName);

    // Try to get client from wallet provider first, fall back to our own client
    let client;
    try {
      client = walletProvider?.getPublicClient(chainName);
    } catch (error) {
      elizaLogger.debug(`Using fallback client for ${chainName}:`, error);
      client = this.createPublicClient(chainName);
    }

    // Get native balance with better error handling for testnet
    let nativeBalance;
    try {
      nativeBalance = await client.getBalance({ address });
    } catch (error) {
      elizaLogger.warn(`Failed to get native balance for ${chainName}:`, error);
      nativeBalance = 0n;
    }
    const nativeBalanceFormatted = formatUnits(nativeBalance, 18);

    // Get tokens for this chain
    let tokens: any[] = [];

    if (isTestnet) {
      tokens =
        (InternalTokenBalanceProvider.TESTNET_TOKEN_DATABASE as any)[
          chainName
        ] || [];
      elizaLogger.info(
        `🧪 Using testnet token database for ${chainName}: ${tokens.length} tokens`
      );
    } else {
      tokens =
        (InternalTokenBalanceProvider.TOKEN_DATABASE as any)[chainName] || [];
      elizaLogger.info(
        `🏦 Using mainnet token database for ${chainName}: ${tokens.length} tokens`
      );
    }

    const tokenHoldings: TokenHolding[] = [];

    // Check balances for each token with better error handling
    await Promise.allSettled(
      tokens.map(async (tokenConfig: any) => {
        try {
          const balance = await client.readContract({
            address: tokenConfig.address as Address,
            abi: InternalTokenBalanceProvider.ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          });

          if (balance && balance > 0n) {
            const formattedBalance = formatUnits(balance, tokenConfig.decimals);

            // MUCH LOWER threshold for testnet tokens to encourage testing
            const minThreshold = isTestnet ? 0.00001 : 0.001;

            if (parseFloat(formattedBalance) > minThreshold) {
              tokenHoldings.push({
                symbol: tokenConfig.symbol,
                name: tokenConfig.name,
                address: tokenConfig.address,
                balance: formattedBalance,
                decimals: tokenConfig.decimals,
                chainName,
                isStakeable: tokenConfig.isStakeable || false,
                stakingOptions: tokenConfig.stakingOptions || [],
                isTestnet: tokenConfig.isTestnet || isTestnet,
              });

              elizaLogger.info(
                `✅ Found ${tokenConfig.symbol} balance: ${formattedBalance} on ${chainName} ${isTestnet ? "(testnet)" : ""}`
              );
            }
          }
        } catch (error) {
          elizaLogger.debug(
            `Failed to get ${tokenConfig.symbol} balance on ${chainName}:`,
            error
          );
        }
      })
    );

    return {
      address: address as string,
      chainName,
      nativeBalance: nativeBalanceFormatted,
      tokenHoldings,
      totalUsdValue: 0, // Would need price API integration
      isTestnet,
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
  static isTestnetRequest(text: string): boolean {
    const lowerText = text.toLowerCase();
    return (
      lowerText.includes("testnet") ||
      lowerText.includes("sepolia") ||
      lowerText.includes("goerli") ||
      lowerText.includes("mumbai") ||
      lowerText.includes("test ") ||
      lowerText.includes("testing")
    );
  }
}

export class WalletAnalyzer implements Provider {
  name = "walletAnalyzer";
  private cache: Cache<WalletAnalysis> = new Cache(10 * 60 * 1000); // 10 minutes
  private tokenBalanceProvider: InternalTokenBalanceProvider;

  constructor() {
    this.tokenBalanceProvider = new InternalTokenBalanceProvider();
  }

  public async get(
    runtime: IAgentRuntime,
    message: Memory,
    state?: State
  ): Promise<ProviderResult> {
    const walletAddress = Validator.extractWalletAddress(
      message.content.text || ""
    );

    if (!walletAddress || !Validator.isValidAddress(walletAddress)) {
      throw new Error("Invalid wallet address provided");
    }

    // Detect testnet request
    const isTestnetRequest = Validator.isTestnetRequest(
      message.content.text || ""
    );

    try {
      const analysis = await this.analyzeWallet(
        runtime,
        walletAddress,
        isTestnetRequest
      );

      // Format comprehensive response with staking focus
      const agentName = state?.agentName || "The agent";

      return {
        text: this.formatAnalysisWithStaking(analysis, agentName),
        data: analysis,
        values: {
          address: analysis.address,
          totalBalance: analysis.totalBalance,
          totalTokens: analysis.tokenHoldings.length.toString(),
          stakingRecommendations:
            analysis.stakingRecommendations.length.toString(),
          recommendedStakingAmount: analysis.stakingRecommendations
            .reduce((sum, rec) => sum + parseFloat(rec.recommendedAmount), 0)
            .toString(),
          riskScore: analysis.riskProfile.riskScore.toString(),
          diversificationScore: analysis.diversificationScore.toString(),
          analysis: JSON.stringify(analysis),
          isTestnet: analysis.tokenHoldings.some((t) => t.isTestnet).toString(),
        },
      };
    } catch (error) {
      elizaLogger.error(`❌ Provider error:`, error);
      throw error;
    }
  }

  // Main analysis method with testnet support
  async analyzeWallet(
    runtime: IAgentRuntime,
    address: string,
    testnetOnly: boolean = false
  ): Promise<WalletAnalysis> {
    const cacheKey = `${address}_analysis_${testnetOnly ? "testnet" : "all"}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      elizaLogger.info(
        `📋 Using cached analysis for ${address} (testnet: ${testnetOnly})`
      );
      return cached;
    }

    elizaLogger.info(
      `🔍 Analyzing wallet with staking recommendations: ${address} (testnet mode: ${testnetOnly})`
    );

    try {
      const analysis = await this.performComprehensiveAnalysisWithStaking(
        runtime,
        address,
        testnetOnly
      );
      this.cache.set(cacheKey, analysis);
      elizaLogger.info(
        `✅ Comprehensive wallet analysis with staking completed for ${address}`
      );

      return analysis;
    } catch (error) {
      elizaLogger.error(`❌ Error analyzing wallet ${address}:`, error);
      throw new Error(
        `Failed to analyze wallet: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  // Enhanced analysis method with better error handling and no fallbacks
  private async performComprehensiveAnalysisWithStaking(
    runtime: IAgentRuntime,
    address: string,
    testnetOnly: boolean = false
  ): Promise<WalletAnalysis> {
    // Validate EVM plugin availability
    if (!initWalletProvider) {
      throw new Error(
        "EVM plugin not available - cannot perform wallet analysis"
      );
    }

    // Validate runtime has required EVM configuration with better error handling
    await this.validateEvmConfigurationStrict(runtime);

    let walletProvider;
    try {
      // Enhanced wallet provider initialization with retries
      walletProvider = await this.initWalletProviderWithRetry(runtime);
      elizaLogger.info("✅ Wallet provider initialized successfully");
    } catch (error) {
      elizaLogger.error("Failed to initialize wallet provider:", error);
      throw new Error(
        `Wallet provider initialization failed: ${error.message}`
      );
    }

    const isOwnWallet =
      address.toLowerCase() === walletProvider.getAddress().toLowerCase();

    // Get wallet data with better error handling
    let walletData;
    try {
      if (!testnetOnly) {
        walletData = await evmWalletProvider.get(runtime, {} as Memory);
      }
    } catch (error) {
      elizaLogger.warn(
        "Failed to get wallet data from evmWalletProvider:",
        error
      );
    }

    // Get token balances with enhanced error handling and retries
    const tokenBalances = await this.getTokenBalancesWithRetry(
      walletProvider,
      address as Address,
      testnetOnly
    );

    // Extract and enrich token holdings with staking info
    const allTokenHoldings = tokenBalances.flatMap(
      (chain) => chain.tokenHoldings
    );

    // Get native balances and add ETH staking options
    const nativeBalances: Record<string, string> = {};
    tokenBalances.forEach((chain) => {
      nativeBalances[chain.chainName] = chain.nativeBalance;
    });

    const totalNativeBalance = Object.values(nativeBalances).reduce(
      (sum, balance) => sum + parseFloat(balance),
      0
    );

    // Only include current staking positions that actually exist
    const currentStakingPositions = allTokenHoldings.filter(
      (token) =>
        ["stETH", "rETH", "cbETH", "sfrxETH"].includes(token.symbol) &&
        parseFloat(token.balance) > 0
    );

    // Perform comprehensive analysis
    const tokenAnalysis = this.analyzeTokenHoldings(allTokenHoldings);
    const diversificationScore = this.calculateDiversificationScore(
      allTokenHoldings,
      nativeBalances
    );
    const riskProfile = this.assessComprehensiveRisk(
      totalNativeBalance,
      allTokenHoldings,
      tokenAnalysis
    );
    const behaviorPatterns = this.inferBehaviorFromHoldings(
      allTokenHoldings,
      tokenBalances
    );
    const preferredAssets = this.analyzeAssetPreferences(
      allTokenHoldings,
      nativeBalances
    );
    const liquidityNeeds = this.assessLiquidityProfile(
      allTokenHoldings,
      totalNativeBalance
    );

    // Generate staking strategy and recommendations - ONLY for actual holdings
    const stakingStrategy = this.generateStakingStrategy(
      riskProfile,
      liquidityNeeds,
      totalNativeBalance,
      testnetOnly
    );

    // REMOVED: Force mock recommendations - only recommend based on actual holdings
    const stakingRecommendations = this.generateRealStakingRecommendations(
      nativeBalances,
      allTokenHoldings,
      stakingStrategy,
      riskProfile,
      testnetOnly
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
      evmCapabilities: this.getEVMCapabilities(walletProvider, testnetOnly),
    };
  }

  //Strict EVM configuration validation with better error messages
  private async validateEvmConfigurationStrict(
    runtime: IAgentRuntime
  ): Promise<void> {
    const evmPrivateKey = runtime.getSetting("EVM_PRIVATE_KEY");

    if (!evmPrivateKey) {
      throw new Error(
        "EVM_PRIVATE_KEY not found in runtime settings. Please configure EVM_PRIVATE_KEY environment variable."
      );
    }

    const fixedKey = this.normalizePrivateKey(evmPrivateKey);
    if (!fixedKey) {
      throw new Error(
        "Invalid EVM_PRIVATE_KEY format. Must be 64 character hex string (with or without 0x prefix)."
      );
    }

    runtime.setSetting("EVM_PRIVATE_KEY", fixedKey);
    elizaLogger.info("✅ EVM configuration validated successfully");
  }

  //Wallet provider initialization with retry logic
  private async initWalletProviderWithRetry(
    runtime: IAgentRuntime,
    maxRetries: number = 3
  ): Promise<any> {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        elizaLogger.info(
          `Initializing wallet provider (attempt ${attempt}/${maxRetries})`
        );
        const provider = await initWalletProvider(runtime);
        return provider;
      } catch (error) {
        lastError = error;
        elizaLogger.warn(
          `Wallet provider init attempt ${attempt} failed:`,
          error.message
        );

        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          elizaLogger.info(`Retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to initialize wallet provider after ${maxRetries} attempts: ${lastError.message}`
    );
  }

  // Token balance retrieval with retry logic and better error handling
  private async getTokenBalancesWithRetry(
    walletProvider: any,
    address: Address,
    testnetOnly: boolean,
    maxRetries: number = 3
  ): Promise<TokenBalanceData[]> {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        elizaLogger.info(
          `Fetching token balances (attempt ${attempt}/${maxRetries})`
        );

        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Token balance fetch timeout")),
            60000
          ); // 60 second timeout
        });

        const balancePromise = this.tokenBalanceProvider.getTokenBalances(
          walletProvider,
          address,
          testnetOnly
        );

        const tokenBalances = (await Promise.race([
          balancePromise,
          timeoutPromise,
        ])) as TokenBalanceData[];

        elizaLogger.info(
          `✅ Successfully retrieved token balances for ${tokenBalances.length} chains`
        );
        return tokenBalances;
      } catch (error) {
        lastError = error;
        elizaLogger.warn(
          `Token balance fetch attempt ${attempt} failed:`,
          error.message
        );

        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const delay = Math.pow(2, attempt) * 2000;
          elizaLogger.info(`Retrying token balance fetch in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Failed to fetch token balances after ${maxRetries} attempts: ${lastError.message}`
    );
  }

  private normalizePrivateKey(privateKey: string): string | null {
    try {
      let cleanKey = privateKey.trim();

      if (cleanKey.startsWith("0x")) {
        cleanKey = cleanKey.slice(2);
      }

      if (cleanKey.length !== 64) {
        elizaLogger.warn(
          `Private key has invalid length: ${cleanKey.length}, expected 64`
        );
        return null;
      }

      const hexRegex = /^[0-9a-fA-F]+$/;
      if (!hexRegex.test(cleanKey)) {
        elizaLogger.warn("Private key contains invalid hex characters");
        return null;
      }

      return `0x${cleanKey}`;
    } catch (error) {
      elizaLogger.warn("Error normalizing private key:", error);
      return null;
    }
  }

  // Only generate recommendations for actual holdings - NO MOCK DATA
  private generateRealStakingRecommendations(
    nativeBalances: Record<string, string>,
    tokenHoldings: TokenHolding[],
    strategy: StakingStrategy,
    riskProfile: WalletRiskProfile,
    testnetOnly: boolean = false
  ): StakingRecommendation[] {
    const recommendations: StakingRecommendation[] = [];

    // ETH Staking Recommendations - ONLY for actual balances above meaningful thresholds
    Object.entries(nativeBalances).forEach(([chainName, balance]) => {
      const ethBalance = parseFloat(balance);
      const isTestnet = InternalTokenBalanceProvider.isTestnetChain(chainName);

      // Skip if we're in testnet mode but this isn't a testnet chain, or vice versa
      if (testnetOnly && !isTestnet) return;
      if (!testnetOnly && isTestnet) return;

      // Set realistic minimum thresholds - no tiny amounts
      const minThreshold = isTestnet ? 0.01 : 0.1; // Higher thresholds

      if (ethBalance > minThreshold) {
        let recommendedEthAmount: number;

        if (isTestnet) {
          // For testnet: recommend 40% of balance (keeping 60% for gas and testing)
          recommendedEthAmount = ethBalance * 0.4;
        } else {
          recommendedEthAmount =
            ethBalance * (strategy.recommendedAllocation / 100);
        }

        // Set meaningful minimum recommendation amounts
        const minRecommendation = isTestnet ? 0.005 : 0.05;

        if (recommendedEthAmount >= minRecommendation) {
          // Use actual staking options - no mock protocols
          const ethOptions = isTestnet
            ? InternalTokenBalanceProvider.TESTNET_ETH_STAKING_OPTIONS?.filter(
                (option) => {
                  if (strategy.riskTolerance === "CONSERVATIVE")
                    return option.riskLevel === "LOW";
                  if (strategy.riskTolerance === "MODERATE")
                    return option.riskLevel !== "HIGH";
                  return true;
                }
              ) || []
            : InternalTokenBalanceProvider.ETH_STAKING_OPTIONS?.filter(
                (option) => {
                  if (strategy.riskTolerance === "CONSERVATIVE")
                    return option.riskLevel === "LOW";
                  if (strategy.riskTolerance === "MODERATE")
                    return option.riskLevel !== "HIGH";
                  return true;
                }
              ) || [];

          // Only proceed if we have actual staking options
          if (ethOptions.length > 0) {
            const reasoning = isTestnet
              ? `With ${ethBalance.toFixed(4)} ETH on ${chainName} testnet, you can stake ${recommendedEthAmount.toFixed(4)} ETH to test staking workflows.`
              : `Based on your ${riskProfile.riskTolerance.toLowerCase()} risk profile and ${ethBalance.toFixed(2)} ETH balance on ${chainName}, staking ${recommendedEthAmount.toFixed(4)} ETH can generate steady yield.`;

            recommendations.push({
              recommendedAmount: recommendedEthAmount.toFixed(6),
              token: "ETH",
              options: ethOptions,
              reasoning,
              riskAssessment: `${strategy.riskTolerance} risk tolerance suggests ${ethOptions[0]?.protocol || "liquid staking"} protocols.`,
              expectedReturn: `${((recommendedEthAmount * (ethOptions[0]?.expectedApr || 3.2)) / 100).toFixed(6)} ETH annually`,
              priority:
                ethBalance > 5 ? "HIGH" : ethBalance > 1 ? "MEDIUM" : "LOW",
              isTestnet,
            });
          }
        }
      }
    });

    // Token Staking Recommendations - ONLY for actual holdings
    const stakeableTokens = tokenHoldings.filter((token) => {
      const hasBalance = parseFloat(token.balance) > 0;
      const isStakeable = token.isStakeable && token.stakingOptions?.length;

      if (testnetOnly) {
        return token.isTestnet && hasBalance && isStakeable;
      }
      return hasBalance && isStakeable && !token.isTestnet;
    });

    for (const token of stakeableTokens) {
      const balance = parseFloat(token.balance);
      const minStakeAmount = parseFloat(
        token.stakingOptions?.[0]?.minAmount || "0"
      );

      // Set realistic minimum thresholds
      const minRecommendAmount = token.isTestnet ? 1.0 : 50;

      if (
        balance > Math.max(minStakeAmount, 0.1) &&
        balance >= minRecommendAmount
      ) {
        const recommendedAmount = balance * 0.7; // Conservative 70%

        const suitableOptions =
          token.stakingOptions?.filter((option) => {
            if (strategy.riskTolerance === "CONSERVATIVE")
              return option.riskLevel === "LOW";
            if (strategy.riskTolerance === "MODERATE")
              return option.riskLevel !== "HIGH";
            return true;
          }) || [];

        if (suitableOptions.length > 0) {
          const reasoning = token.isTestnet
            ? `Your ${balance.toFixed(2)} ${token.symbol} holding on testnet can be used to test lending protocols.`
            : `Your ${balance.toFixed(2)} ${token.symbol} holding can earn yield through lending protocols.`;

          recommendations.push({
            recommendedAmount: recommendedAmount.toFixed(6),
            token: token.symbol,
            options: suitableOptions,
            reasoning,
            riskAssessment: `${suitableOptions[0].riskLevel} risk ${suitableOptions[0].type.toLowerCase()} staking option.`,
            expectedReturn: `${(recommendedAmount * (suitableOptions[0].expectedApr / 100)).toFixed(6)} ${token.symbol} annually`,
            priority:
              balance > 1000 ? "HIGH" : balance > 100 ? "MEDIUM" : "LOW",
            isTestnet: token.isTestnet,
          });
        }
      }
    }

    // Sort by priority, but no artificial recommendations
    return recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // EVM capabilities with testnet support - no mock protocols
  private getEVMCapabilities(
    walletProvider: any,
    testnetOnly: boolean = false
  ): EVMCapabilities {
    const allChains = Object.keys(
      InternalTokenBalanceProvider.CHAIN_CONFIG || {}
    );
    let supportedChains;

    try {
      supportedChains = walletProvider?.getSupportedChains() || allChains;
    } catch (error) {
      supportedChains = testnetOnly
        ? InternalTokenBalanceProvider.getTestnetChains?.() || []
        : InternalTokenBalanceProvider.getMainnetChains?.() || [];
    }

    // Return actual capabilities - no mock data
    return {
      canTransfer: true,
      canBridge: true,
      canSwap: true,
      canStake: true,
      supportedChains,
      preferredDEXs: testnetOnly
        ? [] // Don't recommend mock testnet DEXs
        : ["uniswap", "sushiswap", "1inch"],
      stakingProtocols: testnetOnly
        ? [] // Let actual protocols be discovered
        : ["lido", "rocketpool", "aave", "compound"],
    };
  }

  // REMOVED: performFallbackAnalysis method entirely
  // REMOVED: generateForceTestnetRecommendations method entirely
  // REMOVED: analyzeTestnetWallet method entirely

  private generateStakingStrategy(
    riskProfile: WalletRiskProfile,
    liquidityNeeds: LiquidityProfile,
    totalBalance: number,
    isTestnet: boolean = false
  ): StakingStrategy {
    let recommendedAllocation = 0;
    let preferredProtocols: string[] = [];
    let stakingHorizon = 365;
    let diversificationGoal = 2;

    // For testnet, only recommend based on actual balance and realistic expectations
    if (isTestnet && totalBalance > 0.01) {
      recommendedAllocation = 40; // Conservative for testnet
      preferredProtocols = []; // Let actual discovery find protocols
      stakingHorizon = 90; // Shorter horizon for testing
      diversificationGoal = 1; // Test one protocol at a time
    } else if (!isTestnet) {
      // Determine allocation based on risk profile for mainnet
      switch (riskProfile.riskTolerance) {
        case "CONSERVATIVE":
          recommendedAllocation = Math.min(
            40,
            (1 - liquidityNeeds.liquidityRatio) * 60
          );
          preferredProtocols = ["Lido", "Coinbase Wrapped Staked ETH"];
          stakingHorizon = 180;
          diversificationGoal = 1;
          break;
        case "MODERATE":
          recommendedAllocation = Math.min(
            60,
            (1 - liquidityNeeds.liquidityRatio) * 70
          );
          preferredProtocols = ["Lido", "Rocket Pool", "Aave"];
          stakingHorizon = 365;
          diversificationGoal = 2;
          break;
        case "AGGRESSIVE":
          recommendedAllocation = Math.min(
            80,
            (1 - liquidityNeeds.liquidityRatio) * 85
          );
          preferredProtocols = ["Lido", "Rocket Pool", "EigenLayer", "Aave"];
          stakingHorizon = 730;
          diversificationGoal = 3;
          break;
        case "DEGENERATE":
          recommendedAllocation = Math.min(
            90,
            (1 - liquidityNeeds.liquidityRatio) * 95
          );
          preferredProtocols = [
            "EigenLayer",
            "Rocket Pool",
            "Radiant",
            "Moonwell",
          ];
          stakingHorizon = 1095;
          diversificationGoal = 4;
          break;
        default:
          recommendedAllocation = 30;
          preferredProtocols = ["Lido"];
      }
    }

    return {
      recommendedAllocation,
      preferredProtocols,
      riskTolerance: riskProfile.riskTolerance || "MODERATE",
      liquidityBuffer: liquidityNeeds.liquidityRatio * 100,
      stakingHorizon,
      diversificationGoal,
    };
  }

  // [Rest of the methods remain the same - analyzeTokenHoldings, calculateDiversificationScore, etc.]
  private analyzeTokenHoldings(tokenHoldings: TokenHolding[]): TokenAnalysis {
    const stablecoins = tokenHoldings.filter((token) =>
      ["USDC", "USDT", "DAI", "BUSD", "FRAX"].includes(token.symbol)
    );

    const defiTokens = tokenHoldings.filter((token) =>
      ["UNI", "SUSHI", "AAVE", "COMP", "CRV", "YFI", "stETH"].includes(
        token.symbol
      )
    );

    const governanceTokens = tokenHoldings.filter((token) =>
      ["UNI", "COMP", "AAVE", "YFI", "MKR"].includes(token.symbol)
    );

    const stakeableAssets = tokenHoldings.filter((token) => token.isStakeable);

    const sortedHoldings = [...tokenHoldings].sort(
      (a, b) => parseFloat(b.balance) - parseFloat(a.balance)
    );

    const majorHoldings = sortedHoldings.slice(0, 5);

    const totalValue = tokenHoldings.reduce(
      (sum, token) => sum + parseFloat(token.balance),
      0
    );
    const concentrationRisk = tokenHoldings.reduce((risk, token) => {
      const share = parseFloat(token.balance) / totalValue;
      return risk + share * share;
    }, 0);

    const diversificationLevel =
      concentrationRisk > 0.5
        ? "LOW"
        : concentrationRisk > 0.25
          ? "MEDIUM"
          : "HIGH";

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

  private calculateDiversificationScore(
    tokenHoldings: TokenHolding[],
    nativeBalances: Record<string, string>
  ): number {
    const totalAssets =
      tokenHoldings.length + Object.keys(nativeBalances).length;
    const chainCount = Object.keys(nativeBalances).length;

    let score = Math.min(totalAssets * 5, 50);
    score += Math.min(chainCount * 10, 30);

    const tokenTypes = new Set(
      tokenHoldings.map((token) => {
        if (["USDC", "USDT", "DAI"].includes(token.symbol)) return "stablecoin";
        if (["UNI", "SUSHI", "AAVE"].includes(token.symbol)) return "defi";
        return "other";
      })
    );

    score += tokenTypes.size * 5;

    return Math.min(score, 100);
  }

  private assessComprehensiveRisk(
    nativeBalance: number,
    tokenHoldings: TokenHolding[],
    tokenAnalysis: TokenAnalysis
  ): WalletRiskProfile {
    let riskScore = 50;

    if (nativeBalance + tokenHoldings.length > 100) riskScore += 15;
    else if (nativeBalance + tokenHoldings.length > 10) riskScore += 10;
    else if (nativeBalance + tokenHoldings.length < 1) riskScore -= 15;

    riskScore += Math.min(tokenHoldings.length * 2, 20);

    const stablecoinRatio =
      tokenAnalysis.stablecoins.length / Math.max(tokenHoldings.length, 1);
    if (stablecoinRatio > 0.5) riskScore -= 10;
    else if (stablecoinRatio < 0.1) riskScore += 10;

    if (tokenAnalysis.concentrationRisk > 0.5) riskScore += 15;

    riskScore = Math.max(0, Math.min(100, riskScore));

    let stakingRiskTolerance: "LOW" | "MEDIUM" | "HIGH" = "MEDIUM";
    if (riskScore < 30) stakingRiskTolerance = "LOW";
    else if (riskScore > 70) stakingRiskTolerance = "HIGH";

    return {
      riskScore,
      riskTolerance: this.mapRiskScoreToTolerance(riskScore),
      maxSinglePosition: (
        nativeBalance * this.getMaxPositionRatio(riskScore)
      ).toString(),
      diversificationLevel: tokenAnalysis.diversificationLevel,
      lockPeriodTolerance: this.calculateLockPeriodTolerance(riskScore),
      concentrationRisk: tokenAnalysis.concentrationRisk,
      liquidityRisk: this.calculateLiquidityRisk(tokenHoldings),
      stakingRiskTolerance,
    };
  }

  private calculateLiquidityRisk(tokenHoldings: TokenHolding[]): number {
    const liquidTokens = tokenHoldings.filter((token) =>
      ["USDC", "USDT", "DAI", "WETH", "UNI"].includes(token.symbol)
    ).length;

    const totalTokens = tokenHoldings.length;
    return totalTokens > 0 ? 1 - liquidTokens / totalTokens : 0;
  }

  private inferBehaviorFromHoldings(
    tokenHoldings: TokenHolding[],
    tokenBalances: TokenBalanceData[]
  ): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];

    // Multi-chain behavior
    if (tokenBalances.length > 2) {
      patterns.push({
        pattern: "Multi-Chain Power User",
        frequency: tokenBalances.length,
        confidence: 0.9,
        description: `Active across ${tokenBalances.length} different chains`,
        stakingImplication:
          "Consider multi-chain staking strategies for optimal yields",
      });
    }

    // DeFi behavior
    const defiTokens = tokenHoldings.filter((token) =>
      ["UNI", "SUSHI", "AAVE", "COMP", "CRV", "stETH"].includes(token.symbol)
    );

    if (defiTokens.length > 2) {
      patterns.push({
        pattern: "DeFi Enthusiast",
        frequency: defiTokens.length,
        confidence: 0.8,
        description: `Holds ${defiTokens.length} different DeFi protocol tokens`,
        stakingImplication:
          "High comfort with DeFi protocols, suitable for advanced staking strategies",
      });
    }

    // Only note testnet behavior if there are meaningful holdings
    const testnetTokens = tokenHoldings.filter(
      (token) => token.isTestnet && parseFloat(token.balance) > 0
    );
    if (testnetTokens.length > 0) {
      patterns.push({
        pattern: "Testnet User",
        frequency: testnetTokens.length,
        confidence: 0.6,
        description: `Has ${testnetTokens.length} testnet tokens with actual balances`,
        stakingImplication:
          "Familiar with testing protocols, suitable for beta programs",
      });
    }

    return patterns;
  }

  private analyzeAssetPreferences(
    tokenHoldings: TokenHolding[],
    nativeBalances: Record<string, string>
  ): AssetPreference[] {
    const preferences: AssetPreference[] = [];

    // Native token preferences - only for meaningful balances
    Object.entries(nativeBalances).forEach(([chain, balance]) => {
      if (parseFloat(balance) > 0.01) {
        preferences.push({
          token: `${chain.toUpperCase()}_ETH`,
          preference: Math.min(parseFloat(balance) / 10, 1),
          volume: balance,
          type: "NATIVE",
          stakingPotential: parseFloat(balance) > 0.1 ? 0.9 : 0.5,
        });
      }
    });

    // ERC-20 token preferences - only for meaningful balances
    tokenHoldings.forEach((token) => {
      const balance = parseFloat(token.balance);
      if (balance <= 0) return; // Skip zero balances

      let type: "ERC20" | "STABLECOIN" | "DEFI" = "ERC20";
      let stakingPotential = 0.3;

      if (["USDC", "USDT", "DAI"].includes(token.symbol)) {
        type = "STABLECOIN";
        stakingPotential = token.isStakeable ? 0.8 : 0.2;
      } else if (["UNI", "SUSHI", "AAVE", "stETH"].includes(token.symbol)) {
        type = "DEFI";
        stakingPotential = token.isStakeable ? 0.7 : 0.4;
      }

      preferences.push({
        token: token.symbol,
        preference: Math.min(balance / 1000, 1),
        volume: token.balance,
        type,
        stakingPotential,
      });
    });

    return preferences.sort((a, b) => b.preference - a.preference);
  }

  private assessLiquidityProfile(
    tokenHoldings: TokenHolding[],
    nativeBalance: number
  ): LiquidityProfile {
    const liquidTokens = tokenHoldings.filter(
      (token) =>
        ["USDC", "USDT", "DAI", "WETH"].includes(token.symbol) &&
        parseFloat(token.balance) > 0
    );

    const stakedTokens = tokenHoldings.filter(
      (token) =>
        ["stETH", "rETH", "cbETH"].includes(token.symbol) &&
        parseFloat(token.balance) > 0
    );

    const totalValue =
      nativeBalance +
      tokenHoldings.reduce((sum, token) => sum + parseFloat(token.balance), 0);

    const liquidityRatio =
      liquidTokens.length / Math.max(tokenHoldings.length, 1);
    const stakingCapacity = Math.max(
      0,
      totalValue * (1 - Math.max(liquidityRatio, 0.2))
    );

    return {
      liquidityRatio,
      withdrawalFrequency: liquidityRatio > 0.5 ? 4 : 1,
      emergencyBuffer: totalValue * 0.1,
      preferredLockPeriods: liquidityRatio > 0.3 ? [0, 7, 30] : [30, 90, 365],
      liquidAssets: liquidTokens,
      stakedAssets: stakedTokens,
      stakingCapacity,
    };
  }

  private mapRiskScoreToTolerance(
    score: number
  ): "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" | "DEGENERATE" {
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
    if (riskScore < 25) return 7;
    if (riskScore < 50) return 30;
    if (riskScore < 75) return 90;
    return 365;
  }

  // Formatting with no mock data mentions
  private formatAnalysisWithStaking(
    analysis: WalletAnalysis,
    agentName: string
  ): string {
    // Detect if this is a testnet analysis
    const hasTestnetTokens = analysis.tokenHoldings.some(
      (token) => token.isTestnet
    );
    const testnetChains = Object.keys(analysis.nativeBalances).filter((chain) =>
      InternalTokenBalanceProvider.isTestnetChain(chain)
    );
    const isTestnetAnalysis = hasTestnetTokens || testnetChains.length > 0;

    let text = `${agentName}'s ${isTestnetAnalysis ? "🧪 TESTNET " : ""}Comprehensive Wallet Analysis & Staking Strategy for ${analysis.address}:\n\n`;

    if (isTestnetAnalysis) {
      text += `🧪 **TESTNET MODE**\n`;
      text += `Analysis includes testnet tokens and chains.\n`;
      if (testnetChains.length > 0) {
        text += `Testnet Chains: ${testnetChains.join(", ")}\n`;
      }
      if (hasTestnetTokens) {
        text += `Testnet Tokens: ${analysis.tokenHoldings.filter((t) => t.isTestnet).length}\n`;
      }
      text += `\n`;
    }

    // Portfolio Overview
    text += `📊 PORTFOLIO OVERVIEW:\n`;
    text += `Total Native Balance: ${analysis.totalBalance} ETH\n`;
    text += `Token Holdings: ${analysis.tokenHoldings.length} tokens ${isTestnetAnalysis ? "(including testnet)" : ""}\n`;
    text += `Active Chains: ${Object.keys(analysis.nativeBalances).length}\n`;
    text += `Diversification Score: ${analysis.diversificationScore}/100\n`;
    text += `Current Staking Positions: ${analysis.currentStakingPositions.length}\n\n`;

    // Chain-by-chain breakdown
    if (Object.keys(analysis.nativeBalances).length > 1) {
      text += `🌐 CHAIN BREAKDOWN:\n`;
      Object.entries(analysis.nativeBalances).forEach(([chain, balance]) => {
        const isTestnet = InternalTokenBalanceProvider.isTestnetChain(chain);
        const chainTokens = analysis.tokenHoldings.filter(
          (t) => t.chainName === chain
        );
        text += `• ${chain}${isTestnet ? " (testnet)" : ""}: ${parseFloat(balance).toFixed(6)} ETH`;
        if (chainTokens.length > 0) {
          text += ` + ${chainTokens.length} tokens`;
        }
        text += "\n";
      });
      text += "\n";
    }

    // Staking Strategy
    text += `🎯 PERSONALIZED STAKING STRATEGY:\n`;
    text += `Recommended Allocation: ${analysis.stakingStrategy.recommendedAllocation}% of portfolio\n`;
    text += `Risk Tolerance: ${analysis.stakingStrategy.riskTolerance}\n`;
    text += `Liquidity Buffer: ${analysis.stakingStrategy.liquidityBuffer}%\n`;
    text += `Staking Horizon: ${analysis.stakingStrategy.stakingHorizon} days\n`;
    if (analysis.stakingStrategy.preferredProtocols.length > 0) {
      text += `Preferred Protocols: ${analysis.stakingStrategy.preferredProtocols.join(", ")}\n`;
    }
    text += "\n";

    // Staking Recommendations - ONLY show if there are actual recommendations
    if (analysis.stakingRecommendations.length > 0) {
      text += `💰 ${isTestnetAnalysis ? "TESTNET " : ""}STAKING RECOMMENDATIONS:\n`;
      analysis.stakingRecommendations.forEach((rec, index) => {
        const testnetFlag = rec.isTestnet ? "🧪 " : "";
        text += `\n${index + 1}. ${testnetFlag}${rec.token} Staking (${rec.priority} Priority):\n`;
        text += `   💵 Amount: ${rec.recommendedAmount} ${rec.token}\n`;
        text += `   📈 Expected Return: ${rec.expectedReturn}\n`;
        text += `   🎲 Risk: ${rec.riskAssessment}\n`;
        text += `   💡 Reasoning: ${rec.reasoning}\n`;

        if (rec.options.length > 0) {
          text += `   🏛️ Top Protocol: ${rec.options[0].protocol} (${rec.options[0].expectedApr}% APR)\n`;
          text += `   📋 Description: ${rec.options[0].description}\n`;
        }
      });
      text += "\n";
    } else {
      // No recommendations section - don't suggest mock activities
      text += `💰 STAKING OPPORTUNITIES:\n`;
      const totalBalance = parseFloat(analysis.totalBalance);
      if (totalBalance === 0) {
        text += `No staking opportunities identified with current balance of ${analysis.totalBalance} ETH.\n`;
        if (isTestnetAnalysis) {
          text += `Consider acquiring testnet tokens from faucets to test staking workflows.\n`;
        } else {
          text += `Consider accumulating ETH or stablecoins to access staking opportunities.\n`;
        }
      } else {
        text += `Current balance of ${analysis.totalBalance} ETH is below minimum staking thresholds.\n`;
        const minThreshold = isTestnetAnalysis ? "0.01" : "0.1";
        text += `Minimum recommended balance for staking: ${minThreshold} ETH\n`;
      }
      text += "\n";
    }

    // Current Staking Analysis - only show if positions exist
    if (analysis.currentStakingPositions.length > 0) {
      text += `🔒 CURRENT STAKING POSITIONS:\n`;
      analysis.currentStakingPositions.forEach((position) => {
        text += `• ${position.symbol}: ${position.balance} (${position.chainName})\n`;
      });
      text += "\n";
    }

    // Token Analysis with Staking Focus - only show if relevant
    if (analysis.tokenAnalysis.stakeableAssets.length > 0) {
      text += `🪙 STAKEABLE ASSETS ANALYSIS:\n`;
      text += `Total Stakeable Tokens: ${analysis.tokenAnalysis.stakeableAssets.length}\n`;

      const stakeableStablecoins = analysis.tokenAnalysis.stablecoins.filter(
        (t) => t.isStakeable && parseFloat(t.balance) > 0
      );
      const stakeableDefi = analysis.tokenAnalysis.defiTokens.filter(
        (t) => t.isStakeable && parseFloat(t.balance) > 0
      );

      if (stakeableStablecoins.length > 0) {
        text += `Stablecoins Ready for Lending: ${stakeableStablecoins.length}\n`;
      }
      if (stakeableDefi.length > 0) {
        text += `DeFi Tokens with Staking: ${stakeableDefi.length}\n`;
      }

      const testnetStakeable = analysis.tokenAnalysis.stakeableAssets.filter(
        (t) => t.isTestnet && parseFloat(t.balance) > 0
      );
      if (testnetStakeable.length > 0) {
        text += `🧪 Testnet Stakeable Assets: ${testnetStakeable.length}\n`;
      }
      text += "\n";
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
    text += `Staking Capacity: ${analysis.liquidityNeeds.stakingCapacity.toFixed(6)} ETH equivalent\n`;
    text += `Emergency Buffer: ${analysis.liquidityNeeds.emergencyBuffer.toFixed(6)} ETH\n`;
    text += `Liquid Assets: ${analysis.liquidityNeeds.liquidAssets.length}\n`;
    text += `Already Staked: ${analysis.liquidityNeeds.stakedAssets.length}\n\n`;

    // Behavior Patterns - only show meaningful patterns
    const meaningfulPatterns = analysis.behaviorPatterns.filter(
      (pattern) => pattern.frequency > 0 && pattern.confidence > 0.5
    );
    if (meaningfulPatterns.length > 0) {
      text += `🎯 BEHAVIOR PATTERNS & STAKING IMPLICATIONS:\n`;
      meaningfulPatterns.forEach((pattern) => {
        text += `• ${pattern.pattern}: ${pattern.description}\n`;
        if (pattern.stakingImplication) {
          text += `  💡 Staking Implication: ${pattern.stakingImplication}\n`;
        }
      });
      text += "\n";
    }

    // EVM Capabilities
    text += `⚡ STAKING CAPABILITIES:\n`;
    text += `Supported Chains: ${analysis.evmCapabilities.supportedChains.join(", ")}\n`;
    if (analysis.evmCapabilities.stakingProtocols.length > 0) {
      text += `Available Staking Protocols: ${analysis.evmCapabilities.stakingProtocols.join(", ")}\n`;
    }
    text += `Can Stake: ${analysis.evmCapabilities.canStake ? "✅" : "❌"}\n`;
    text += `Can Bridge for Better Yields: ${analysis.evmCapabilities.canBridge ? "✅" : "❌"}\n\n`;

    // Action Items - realistic next steps
    text += `📋 NEXT STEPS:\n`;
    const topRecommendation = analysis.stakingRecommendations[0];
    if (topRecommendation) {
      const testnetPrefix = topRecommendation.isTestnet ? "🧪 " : "";
      text += `1. ${testnetPrefix}Start with ${topRecommendation.token} staking: ${topRecommendation.recommendedAmount} ${topRecommendation.token}\n`;
      text += `2. Use ${topRecommendation.options[0]?.protocol || "recommended protocol"} for ${topRecommendation.options[0]?.expectedApr || "competitive"} APR\n`;
      text += `3. Monitor liquidity needs and adjust allocation as needed\n`;
      if (analysis.stakingStrategy.diversificationGoal > 1) {
        text += `4. Consider diversifying across ${analysis.stakingStrategy.diversificationGoal} protocols for optimal risk/reward\n`;
      }
    } else {
      const totalBalance = parseFloat(analysis.totalBalance);
      if (totalBalance === 0) {
        if (isTestnetAnalysis) {
          text += `1. Acquire testnet tokens from faucets to begin testing\n`;
          text += `2. Start with small amounts to test staking workflows\n`;
          text += `3. Practice unstaking and reward claiming processes\n`;
        } else {
          text += `1. Build up ETH balance to 0.1+ for liquid staking opportunities\n`;
          text += `2. Consider accumulating stablecoins for lending yield\n`;
          text += `3. Explore DeFi protocols on your active chains\n`;
        }
      } else {
        const minThreshold = isTestnetAnalysis ? 0.01 : 0.1;
        text += `1. Accumulate more ETH to reach minimum staking threshold (${minThreshold} ETH)\n`;
        text += `2. Research staking protocols suitable for your risk profile\n`;
        text += `3. Consider gas costs and optimal timing for transactions\n`;
      }
    }

    if (isTestnetAnalysis) {
      text += `\n🧪 **TESTNET USAGE GUIDELINES:**\n`;
      text += `• Focus on learning workflows rather than profits\n`;
      text += `• Test small amounts first to understand gas costs\n`;
      text += `• Document processes for mainnet implementation\n`;
      text += `• Practice emergency procedures and error recovery\n`;
      text += `• Remember: testnet tokens have no real value\n`;
    }

    return text;
  }

  public formatAnalysisResponse(
    analysis: WalletAnalysis,
    agentName: string
  ): string {
    return this.formatAnalysisWithStaking(analysis, agentName);
  }
}