import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { erc20 } from "@goat-sdk/plugin-erc20";
import { sendETH } from "@goat-sdk/wallet-evm";
import { elizaLogger } from "@elizaos/core";
import { createWalletClient, http, parseEther } from "viem";
import { base, mainnet, sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

interface GoatTools {
  wallet: any;
  erc20?: any;
  sendETH?: any;
  aave: {
    supply: (params: { tokenAddress: string; amount: string; }) => Promise<{ hash: any; success: boolean; }>;
    withdraw: (params: { tokenAddress: string; amount: string; }) => Promise<any>;
  };
  [key: string]: any;
}

interface ChainConfig {
  id: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

// Supported chains configuration
const SUPPORTED_CHAINS: Record<string, ChainConfig> = {
  mainnet: {
    id: 1,
    name: "Ethereum Mainnet",
    rpcUrl: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
  },
  base: {
    id: 8453,
    name: "Base",
    rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
  },
  sepolia: {
    id: 11155111,
    name: "Sepolia Testnet",
    rpcUrl: process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 }
  }
};

// Common token addresses by chain
const TOKEN_ADDRESSES = {
  mainnet: {
    USDC: "0xA0b86a33E6441E026A6e15C3b7d4fB2B5bFf1b8b",
    USDT: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
  },
  base: {
    USDC: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    USDbC: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", 
    WETH: "0x4200000000000000000000000000000000000006"
  },
  sepolia: {
    USDC: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", // Testnet USDC
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14"
  }
};

// Protocol contract addresses
const PROTOCOL_ADDRESSES = {
  mainnet: {
    aave: {
      lendingPool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
      wethGateway: "0x893411580e590D62dDBca8a703d61Cc4A8c7b2b9"
    },
    compound: {
      comptroller: "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B",
      cUSDC: "0x39AA39c021dfbaE8faC545936693aC917d5E7563"
    },
    lido: {
      stETH: "0xae7ab96520DE3A18E5e111B5EaAb95820049f298"
    }
  },
  base: {
    aave: {
      lendingPool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
      wethGateway: "0x8be473dCfA93132658821E67CbEB684ec8Ea2E74"
    },
    compound: {
      comptroller: "0x05c9C6417F246600f8f5f49fcA9Ee991bfF73637",
      cUSDC: "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf"
    }
  }
};

class GoatWalletManager {
  private walletClient: any;
  private chain: string;
  private tools: GoatTools | null = null;

  constructor(chain: string = 'base') {
    this.chain = chain;
    this.initializeWallet();
  }

  private initializeWallet(): void {
    try {
      const privateKey = process.env.EVM_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('EVM_PRIVATE_KEY environment variable is required');
      }

      const chainConfig = SUPPORTED_CHAINS[this.chain];
      if (!chainConfig) {
        throw new Error(`Unsupported chain: ${this.chain}`);
      }

      const account = privateKeyToAccount(privateKey as `0x${string}`);
      
      let viemChain;
      switch (this.chain) {
        case 'mainnet':
          viemChain = mainnet;
          break;
        case 'base':
          viemChain = base;
          break;
        case 'sepolia':
          viemChain = sepolia;
          break;
        default:
          viemChain = base;
      }

      this.walletClient = createWalletClient({
        account,
        chain: viemChain,
        transport: http(chainConfig.rpcUrl)
      });

      elizaLogger.info(`GOAT wallet initialized for chain: ${this.chain}`);
    } catch (error) {
      elizaLogger.error('Failed to initialize GOAT wallet:', error);
      throw error;
    }
  }

  async initializeTools(): Promise<GoatTools> {
    try {
      if (this.tools) {
        return this.tools;
      }
      

      // Initialize GOAT tools with the wallet
      const tools = await getOnChainTools({
        wallet: this.walletClient,
        plugins: [
          erc20({
            tokens: this.getTokensForChain()
          }),
          sendETH()
        ]
      });

      // Add custom methods for staking protocols
      const enhancedTools = {
        ...tools,
        wallet: this.walletClient,
        
        // Aave integration
        aave: {
          supply: async (params: { tokenAddress: string; amount: string }) => {
            return this.executeAaveSupply(params);
          },
          withdraw: async (params: { tokenAddress: string; amount: string }) => {
            return this.executeAaveWithdraw(params);
          }
        },

        // Compound integration  
        compound: {
          supply: async (params: { tokenAddress: string; amount: string }) => {
            return this.executeCompoundSupply(params);
          },
          redeem: async (params: { tokenAddress: string; amount: string }) => {
            return this.executeCompoundRedeem(params);
          }
        },

        // Lido integration
        lido: {
          stake: async (params: { amount: string }) => {
            return this.executeLidoStake(params);
          }
        },

        // Generic balance checking
        balances: {
          getETHBalance: async (address: string) => {
            return this.getETHBalance(address);
          },
          getTokenBalance: async (params: { tokenAddress: string; account: string }) => {
            return this.getTokenBalance(params);
          }
        }
      };
      

      this.tools = enhancedTools;
      elizaLogger.info('GOAT tools initialized successfully');
      return enhancedTools;

    } catch (error) {
      elizaLogger.error('Failed to initialize GOAT tools:', error);
      throw error;
    }
  }

  private getTokensForChain() {
  const chainTokens = TOKEN_ADDRESSES[this.chain as keyof typeof TOKEN_ADDRESSES] || {};
  return Object.entries(chainTokens).map(([symbol, address]) => ({
    symbol,
    address,
    decimals: symbol.includes('USDC') || symbol.includes('USDT') ? 6 : 18,
    name: symbol,
    // Construct the 'chains' property as a Record<number, { contractAddress: string }>
    chains: {
      [Number(this.chain)]: { 
        contractAddress: address as `0x${string}`
      }
    }
  }));
}

  private async executeAaveSupply(params: { tokenAddress: string; amount: string }) {
    try {
      const protocols = PROTOCOL_ADDRESSES[this.chain as keyof typeof PROTOCOL_ADDRESSES];
      if (!protocols?.aave) {
        throw new Error(`Aave not supported on ${this.chain}`);
      }

      // For ETH, use WETH Gateway
      if (params.tokenAddress === 'native' || params.tokenAddress.toLowerCase().includes('eth')) {
        const hash = await this.walletClient.sendTransaction({
          to: protocols.aave.wethGateway,
          value: parseEther(params.amount),
          data: this.encodeAaveETHSupply()
        });

        return { hash, success: true };
      } 
      
      // For ERC20 tokens, use lending pool
      const hash = await this.walletClient.sendTransaction({
        to: protocols.aave.lendingPool,
        data: this.encodeAaveSupply(params.tokenAddress, params.amount)
      });

      return { hash, success: true };

    } catch (error) {
      elizaLogger.error('Aave supply failed:', error);
      throw error;
    }
  }

  private async executeAaveWithdraw(params: { tokenAddress: string; amount: string }) {
    try {
      const protocols = PROTOCOL_ADDRESSES[this.chain as keyof typeof PROTOCOL_ADDRESSES];
      if (!protocols?.aave) {
        throw new Error(`Aave not supported on ${this.chain}`);
      }

      const hash = await this.walletClient.sendTransaction({
        to: protocols.aave.lendingPool,
        data: this.encodeAaveWithdraw(params.tokenAddress, params.amount)
      });

      return { hash, success: true };

    } catch (error) {
      elizaLogger.error('Aave withdraw failed:', error);
      throw error;
    }
  }

  private async executeCompoundSupply(params: { tokenAddress: string; amount: string }) {
    try {
      const protocols = PROTOCOL_ADDRESSES[this.chain as keyof typeof PROTOCOL_ADDRESSES];
      if (!protocols?.compound) {
        throw new Error(`Compound not supported on ${this.chain}`);
      }

      // Use cToken contract for supply
      const cTokenAddress = this.getCTokenAddress(params.tokenAddress);
      
      const hash = await this.walletClient.sendTransaction({
        to: cTokenAddress,
        data: this.encodeCompoundMint(params.amount)
      });

      return { hash, success: true };

    } catch (error) {
      elizaLogger.error('Compound supply failed:', error);
      throw error;
    }
  }

  private async executeCompoundRedeem(params: { tokenAddress: string; amount: string }) {
    try {
      const protocols = PROTOCOL_ADDRESSES[this.chain as keyof typeof PROTOCOL_ADDRESSES];
      if (!protocols?.compound) {
        throw new Error(`Compound not supported on ${this.chain}`);
      }

      const cTokenAddress = this.getCTokenAddress(params.tokenAddress);
      
      const hash = await this.walletClient.sendTransaction({
        to: cTokenAddress,
        data: this.encodeCompoundRedeem(params.amount)
      });

      return { hash, success: true };

    } catch (error) {
      elizaLogger.error('Compound redeem failed:', error);
      throw error;
    }
  }

  private async executeLidoStake(params: { amount: string }) {
    try {
      if (this.chain !== 'mainnet') {
        throw new Error('Lido only available on Ethereum mainnet');
      }

      const protocols = PROTOCOL_ADDRESSES[this.chain];
      if (!protocols?.lido) {
        throw new Error('Lido contract not found');
      }

      const hash = await this.walletClient.sendTransaction({
        to: protocols.lido.stETH,
        value: parseEther(params.amount),
        data: '0x' // Simple ETH transfer to Lido triggers staking
      });

      return { hash, success: true };

    } catch (error) {
      elizaLogger.error('Lido stake failed:', error);
      throw error;
    }
  }

  private async getETHBalance(address: string): Promise<string> {
    try {
      const balance = await this.walletClient.getBalance({ address });
      return balance.toString();
    } catch (error) {
      elizaLogger.error('Failed to get ETH balance:', error);
      return '0';
    }
  }

  private async getTokenBalance(params: { tokenAddress: string; account: string }): Promise<string> {
    try {
      // Use the ERC20 tools from GOAT if available
      if (this.tools?.erc20?.balanceOf) {
        return await this.tools.erc20.balanceOf(params);
      }
      
      // Fallback to direct contract call
      const balance = await this.walletClient.readContract({
        address: params.tokenAddress,
        abi: [
          {
            name: 'balanceOf',
            type: 'function',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }]
          }
        ],
        functionName: 'balanceOf',
        args: [params.account]
      });

      return balance.toString();
    } catch (error) {
      elizaLogger.error('Failed to get token balance:', error);
      return '0';
    }
  }

  // Helper methods for encoding transaction data
  private encodeAaveETHSupply(): string {
    // depositETH(address lendingPool, address onBehalfOf, uint16 referralCode)
    return '0x474cf53d000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';
  }

  private encodeAaveSupply(tokenAddress: string, amount: string): string {
    // supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)
    // Simplified encoding
    return '0x617ba037' + 
           tokenAddress.slice(2).padStart(64, '0') +
           parseEther(amount).toString(16).padStart(64, '0') +
           this.walletClient.account.address.slice(2).padStart(64, '0') +
           '0'.padStart(64, '0');
  }

  private encodeAaveWithdraw(tokenAddress: string, amount: string): string {
    // withdraw(address asset, uint256 amount, address to)
    return '0x69328dec' +
           tokenAddress.slice(2).padStart(64, '0') +
           parseEther(amount).toString(16).padStart(64, '0') +
           this.walletClient.account.address.slice(2).padStart(64, '0');
  }

  private encodeCompoundMint(amount: string): string {
    // mint(uint mintAmount)
    return '0xa0712d68' + parseEther(amount).toString(16).padStart(64, '0');
  }

  private encodeCompoundRedeem(amount: string): string {
    // redeem(uint redeemTokens)
    return '0xdb006a75' + parseEther(amount).toString(16).padStart(64, '0');
  }

  private getCTokenAddress(tokenAddress: string): string {
    const protocols = PROTOCOL_ADDRESSES[this.chain as keyof typeof PROTOCOL_ADDRESSES];
    
    // Map token addresses to cToken addresses
    if (tokenAddress.toLowerCase() === TOKEN_ADDRESSES[this.chain as keyof typeof TOKEN_ADDRESSES]?.USDC?.toLowerCase()) {
      return protocols?.compound?.cUSDC || '';
    }
    
    // Add more mappings as needed
    throw new Error(`cToken not found for token: ${tokenAddress}`);
  }

  // Chain management
  async switchChain(newChain: string): Promise<void> {
    if (!SUPPORTED_CHAINS[newChain]) {
      throw new Error(`Unsupported chain: ${newChain}`);
    }

    this.chain = newChain;
    this.tools = null; // Reset tools
    this.initializeWallet();
    await this.initializeTools();
    
    elizaLogger.info(`Switched to chain: ${newChain}`);
  }

  getChain(): string {
    return this.chain;
  }

  getSupportedChains(): string[] {
    return Object.keys(SUPPORTED_CHAINS);
  }

  getTokenAddresses(): Record<string, string> {
    return TOKEN_ADDRESSES[this.chain as keyof typeof TOKEN_ADDRESSES] || {};
  }

  getProtocolAddresses(): any {
    return PROTOCOL_ADDRESSES[this.chain as keyof typeof PROTOCOL_ADDRESSES] || {};
  }
}

// Singleton instance
let goatManager: GoatWalletManager | null = null;

export function getGoatManager(chain: string = 'base'): GoatWalletManager {
  if (!goatManager || goatManager.getChain() !== chain) {
    goatManager = new GoatWalletManager(chain);
  }
  return goatManager;
}

// Main function to get onchain tools - compatible with existing code
export async function getOnChainActionTools(chain: string = 'base'): Promise<GoatTools> {
  try {
    const manager = getGoatManager(chain);
    return await manager.initializeTools();
  } catch (error) {
    elizaLogger.error('Failed to get onchain tools:', error);
    throw error;
  }
}

// Utility functions for common operations
export async function checkWalletConnection(): Promise<boolean> {
  try {
    const manager = getGoatManager();
    const tools = await manager.initializeTools();
    return !!tools.wallet;
  } catch (error) {
    elizaLogger.error('Wallet connection check failed:', error);
    return false;
  }
}

export async function getWalletAddress(): Promise<string> {
  try {
    const manager = getGoatManager();
    const tools = await manager.initializeTools();
    return tools.wallet.account.address;
  } catch (error) {
    elizaLogger.error('Failed to get wallet address:', error);
    throw error;
  }
}

export async function estimateGas(params: {
  to: string;
  data?: string;
  value?: bigint;
}): Promise<bigint> {
  try {
    const manager = getGoatManager();
    const tools = await manager.initializeTools();
    
    return await tools.wallet.estimateGas({
      account: tools.wallet.account,
      to: params.to,
      data: params.data,
      value: params.value
    });
  } catch (error) {
    elizaLogger.error('Gas estimation failed:', error);
    throw error;
  }
}

// Export types and constants
export {
  GoatWalletManager,
  SUPPORTED_CHAINS,
  TOKEN_ADDRESSES,
  PROTOCOL_ADDRESSES,
  type GoatTools,
  type ChainConfig
};