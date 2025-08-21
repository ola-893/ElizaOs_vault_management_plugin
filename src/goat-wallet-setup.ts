import { http, createWalletClient, WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, base, arbitrum, polygon } from "viem/chains";

import { getOnChainActions } from "@goat-sdk/adapter-eliza";
import { erc20, USDC, PEPE, MODE } from "@goat-sdk/plugin-erc20";
import { sendETH } from "@goat-sdk/wallet-evm";
import { viem } from "@goat-sdk/wallet-viem";

// Environment variables setup
const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY;
const EVM_PROVIDER_URL = process.env.EVM_PROVIDER_URL;

if (!EVM_PRIVATE_KEY) {
  throw new Error("EVM_PRIVATE_KEY environment variable is required");
}

if (!EVM_PROVIDER_URL) {
  console.warn("EVM_PROVIDER_URL not provided, using public RPC");
}

// Chain configuration - you can modify this based on your needs
const CHAIN_CONFIG = {
  mainnet: {
    chain: mainnet,
    rpcUrl: process.env.MAINNET_RPC_URL || "https://eth.llamarpc.com",
    tokens: {
      USDC: "0xa0b86a33e6ff3016c0a58b5d54e34ad5b60c8a8d",
      WETH: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    }
  },
  base: {
    chain: base,
    rpcUrl: process.env.BASE_RPC_URL || EVM_PROVIDER_URL || "https://mainnet.base.org",
    tokens: {
      USDC: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      WETH: "0x4200000000000000000000000000000000000006",
    }
  },
  arbitrum: {
    chain: arbitrum,
    rpcUrl: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    tokens: {
      USDC: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      WETH: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    }
  },
  polygon: {
    chain: polygon,
    rpcUrl: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    tokens: {
      USDC: "0x2791bca1f2de4661ed88a30c99a7a9449aa84174",
      WETH: "0x7ceb23fd6f88b2e72a7d34dd2da1d8b8ed0f8c58",
    }
  }
};

// Default to base chain
const CURRENT_CHAIN = process.env.CHAIN_NAME as keyof typeof CHAIN_CONFIG || 'base';
const chainConfig = CHAIN_CONFIG[CURRENT_CHAIN];

if (!chainConfig) {
  throw new Error(`Unsupported chain: ${CURRENT_CHAIN}. Supported chains: ${Object.keys(CHAIN_CONFIG).join(', ')}`);
}

const account = privateKeyToAccount(EVM_PRIVATE_KEY as `0x${string}`);

const walletClient:WalletClient = createWalletClient({
    account: account,  // Notice: account property first
    transport: http(chainConfig.rpcUrl),
    chain: chainConfig.chain,
});

const wallet = viem(walletClient);

// Get onchain actions with staking-focused plugins
export const getOnChainTools = () => {
  try {
    const actions = getOnChainActions({
      wallet: wallet,
      plugins: [
        sendETH(), // For ETH transfers
        erc20({ 
          tokens: [USDC, PEPE, MODE] // These will be overridden by chain-specific tokens
        }),
        // Add staking-specific plugins here when available:
        // aave(), compound(), lido(), etc.
      ],
    });
    
    console.log('GOAT onchain actions initialized successfully');
    console.log('Available actions:', Object.keys(actions));
    
    return actions;
  } catch (error) {
    console.error('Error initializing GOAT onchain actions:', error);
    throw error;
  }
};

// Helper function to get token addresses for current chain
export const getTokenAddress = (tokenSymbol: string): string => {
  const address = chainConfig.tokens[tokenSymbol as keyof typeof chainConfig.tokens];
  if (!address) {
    throw new Error(`Token ${tokenSymbol} not configured for chain ${CURRENT_CHAIN}`);
  }
  return address;
};

// Helper function to get current chain info
export const getCurrentChainInfo = () => {
  return {
    name: CURRENT_CHAIN,
    chainId: chainConfig.chain.id,
    rpcUrl: chainConfig.rpcUrl,
    tokens: chainConfig.tokens,
  };
};

// Helper function to check if wallet is connected
export const isWalletConnected = async () => {
  try {
    const balance = await walletClient.getChainId();
    return { connected: true, address: account.address, balance };
  } catch (error) {
    console.error('Wallet connection check failed:', error);
    return { connected: false, error: error.message };
  }
};

// Export wallet and client for direct use if needed
export { wallet, walletClient, account, CURRENT_CHAIN, CHAIN_CONFIG };