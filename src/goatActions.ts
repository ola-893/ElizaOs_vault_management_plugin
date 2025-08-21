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

// Define interfaces for staking opportunities and transaction results
interface StakingOpportunity {
  protocol: string;
  token: string;
  apy: number;
  balance: string;
  chain: string;
  tokenAddress: string;
  stakingContract?: string;
  minAmount?: string;
  maxAmount?: string;
  description?: string;
}

interface StakingTransactionResult {
  success: boolean;
  hash?: string;
  error?: string;
  gasUsed?: string;
  gasPrice?: string;
}

interface WalletBalance {
  token: string;
  balance: string;
  tokenAddress: string;
  decimals?: number;
  usdValue?: string;
}

// Staking Selection Action - Triggered by user selecting an opportunity
const selectStakingAction: Action = {
  name: 'SELECT_STAKING',
  similes: [
    'select staking',
    'choose staking',
    'pick opportunity',
    'stake option',
    'staking selection'
  ],
  description: 'Select a staking opportunity from available options',
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const content = message.content?.text?.toLowerCase() || '';
    
    // Check if user is responding to opportunities with a number or protocol name
    const isNumericSelection = /^(1|2|3|4|5)$/.test(content.trim());
    const hasStakingKeywords = content.includes('stake') && (
      content.includes('aave') ||
      content.includes('compound') ||
      content.includes('lido') ||
      content.includes('rocket') ||
      content.includes('yearn') ||
      content.includes('select') ||
      content.includes('choose') ||
      content.includes('pick')
    );
    
    return isNumericSelection || hasStakingKeywords;
  },
  
  handler: async (
    runtime: IAgentRuntime, 
    message: Memory, 
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<void | ActionResult | undefined> => {
    try {
      elizaLogger.info('Processing staking selection');
      
      const content = message.content?.text?.trim() || '';
      
      // Get previous opportunities from state or recent memories
      const opportunities = await getPreviousOpportunities(runtime, message);
      
      if (!opportunities?.length) {
        const response = 'Please first analyze your wallet to see available staking opportunities. Use: `analyze my wallet [address]`';
        
        if (callback) {
          callback({ text: response });
        }
        return { text: response, success: false };
      }
      
      // Parse user selection
      let selectedOpp: StakingOpportunity | undefined;
      
      if (/^[1-5]$/.test(content)) {
        const index = parseInt(content) - 1;
        selectedOpp = opportunities[index];
      } else {
        // Find by protocol name
        selectedOpp = opportunities.find((opp: StakingOpportunity) => 
          content.toLowerCase().includes(opp.protocol.toLowerCase())
        );
      }
      
      if (!selectedOpp) {
        const availableOptions = opportunities.map((opp: StakingOpportunity, i: number) => 
          `${i + 1}. ${opp.protocol} - ${opp.token} (${opp.apy}% APY)`
        ).join('\n');
        
        const response = `❌ Invalid selection. Please choose from:\n${availableOptions}\n\nReply with the number or protocol name.`;
        
        if (callback) {
          callback({ text: response });
        }
        return { text: response, success: false };
      }
      
      // Show confirmation details and ask for amount
      const response = `🔍 **Selected Staking Opportunity:**\n\n` +
            `Protocol: **${selectedOpp.protocol}**\n` +
            `Token: **${selectedOpp.token}**\n` +
            `APY: **${selectedOpp.apy}%**\n` +
            `Available Balance: **${selectedOpp.balance} ${selectedOpp.token}**\n` +
            `Network: **${selectedOpp.chain}**\n` +
            `${selectedOpp.minAmount ? `Min Amount: **${selectedOpp.minAmount} ${selectedOpp.token}**\n` : ''}` +
            `${selectedOpp.maxAmount ? `Max Amount: **${selectedOpp.maxAmount} ${selectedOpp.token}**\n` : ''}` +
            `\nHow much ${selectedOpp.token} would you like to stake?\n` +
            `Reply with amount (e.g., "100") or "max" for maximum available.`;

      const result: ActionResult = {
        text: response,
        success: true,
        data: { 
          selectedOpportunity: selectedOpp,
          action: 'SELECT_STAKING'
        }
      };

      if (callback) {
        callback({
          text: response,
          success: true,
          data: result.data
        });
      }

      return result;
      
    } catch (error) {
      elizaLogger.error('Error in staking selection:', error);
      
      const errorMessage = `❌ Failed to process selection: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      if (callback) {
        callback({ text: errorMessage });
      }
      return { text: errorMessage, success: false };
    }
  },
  
  examples: [
    [
      {
        user: '{{user1}}',
        content: { text: '2' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Great choice! You selected the Aave USDC staking opportunity. How much would you like to stake?',
          action: 'SELECT_STAKING',
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'stake in lido' },
      },
      {
        user: '{{agentName}}',
        content: {
          text: 'Perfect! You selected Lido for ETH staking. How much ETH would you like to stake?',
          action: 'SELECT_STAKING',
        },
      },
    ],
  ] as ActionExample[][],
};

// Execute Staking Action - Final transaction execution
const executeStakingAction: Action = {
  name: 'EXECUTE_STAKING',
  similes: [
    'confirm stake',
    'execute staking',
    'stake now',
    'approve staking',
    'confirm transaction'
  ],
  description: 'Execute the staking transaction after amount confirmation',
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const content = message.content?.text?.toLowerCase() || '';
    
    // Check for amount, confirmation, or max
    const isAmount = /^\d+(\.\d+)?$/.test(content.trim());
    const isMax = content.trim() === 'max';
    const isConfirm = content.includes('confirm') || content.includes('yes') || content.includes('approve');
    
    return isAmount || isMax || isConfirm;
  },
  
  handler: async (
    runtime: IAgentRuntime, 
    message: Memory, 
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<void | ActionResult | undefined> => {
    try {
      elizaLogger.info('Executing staking transaction');
      
      const content = message.content?.text?.trim() || '';
      
      // Get selected opportunity from previous interaction
      const selectedOpp = await getSelectedOpportunity(runtime, message);
      
      if (!selectedOpp) {
        const response = '❌ Please first select a staking opportunity. Use the SELECT_STAKING action first.';
        
        if (callback) {
          callback({ text: response });
        }
        return { text: response, success: false };
      }
      
      // Parse amount if this is amount specification step
      if (/^\d+(\.\d+)?$/.test(content) || content === 'max') {
        let amount: string;
        
        if (content === 'max') {
          amount = selectedOpp.balance;
        } else {
          amount = content;
          
          // Validate amount against balance
          if (parseFloat(amount) > parseFloat(selectedOpp.balance)) {
            const response = `❌ **Insufficient Balance**\n\nYou requested to stake ${amount} ${selectedOpp.token} but only have ${selectedOpp.balance} ${selectedOpp.token} available.\n\nPlease specify a smaller amount or type 'max' to stake your full balance.`;
            
            if (callback) {
              callback({ text: response });
            }
            return { text: response, success: false };
          }
        }
        
        // Show transaction preview
        const annualRewards = (parseFloat(amount) * selectedOpp.apy / 100).toFixed(4);
        const response = `⚡ **Transaction Preview:**\n\n` +
              `Protocol: **${selectedOpp.protocol}**\n` +
              `Token: **${amount} ${selectedOpp.token}**\n` +
              `Expected APY: **${selectedOpp.apy}%**\n` +
              `Estimated Annual Rewards: **~${annualRewards} ${selectedOpp.token}**\n` +
              `Network: **${selectedOpp.chain}**\n` +
              `Gas Estimate: **~$1-5**\n\n` +
              `This will execute the following:\n` +
              `${selectedOpp.token !== 'ETH' ? '1. Approve token spending\n2. ' : ''}Stake ${amount} ${selectedOpp.token} in ${selectedOpp.protocol}\n\n` +
              `Type **'confirm'** to proceed or **'cancel'** to abort.`;

        const result: ActionResult = {
          text: response,
          success: true,
          data: { 
            selectedOpportunity: selectedOpp,
            amount,
            action: 'CONFIRM_STAKING'
          }
        };

        if (callback) {
          callback({
            text: response,
            success: true,
            data: result.data
          });
        }

        return result;
      }
      
      // Execute transaction if this is confirmation step
      if (content.includes('confirm') || content.includes('yes')) {
        const stakingData = await getStakingDataForConfirmation(runtime, message);
        
        if (!stakingData?.amount) {
          const response = '❌ No staking data found. Please start the process again.';
          
          if (callback) {
            callback({ text: response });
          }
          return { text: response, success: false };
        }
        
        // Send initial processing message
        const processingMessage = `🔄 **Executing Staking Transaction...**\n\nProcessing ${stakingData.amount} ${selectedOpp.token} stake in ${selectedOpp.protocol}...`;
        
        if (callback) {
          callback({ text: processingMessage });
        }
        
        // Execute the actual staking transaction using GOAT SDK
        const result = await executeStakingTransaction(runtime, {
          protocol: selectedOpp.protocol,
          token: selectedOpp.token,
          amount: stakingData.amount,
          tokenAddress: selectedOpp.tokenAddress,
          stakingContract: selectedOpp.stakingContract,
          chain: selectedOpp.chain,
        });
        
        if (result.success) {
          const successResponse = `✅ **Staking Transaction Successful!**\n\n` +
                `📝 Transaction Hash: \`${result.hash}\`\n` +
                `💰 Staked: **${stakingData.amount} ${selectedOpp.token}**\n` +
                `🏦 Protocol: **${selectedOpp.protocol}**\n` +
                `📈 Expected APY: **${selectedOpp.apy}%**\n` +
                `🌐 Network: **${selectedOpp.chain}**\n` +
                `${result.gasUsed ? `⛽ Gas Used: **${result.gasUsed}**\n` : ''}` +
                `\nYour tokens are now earning rewards! 🎉\n\n` +
                `Track your position at the protocol's dashboard.`;

          const finalResult: ActionResult = {
            text: successResponse,
            success: true,
            data: { 
              transactionHash: result.hash, 
              amount: stakingData.amount, 
              protocol: selectedOpp.protocol,
              gasUsed: result.gasUsed
            }
          };

          if (callback) {
            callback({
              text: successResponse,
              success: true,
              data: finalResult.data
            });
          }

          return finalResult;
        } else {
          const errorResponse = `❌ **Transaction Failed**\n\nError: ${result.error}\n\nPossible solutions:\n1. Ensure you have enough ETH for gas fees\n2. Check token balance and allowances\n3. Try again when network congestion is lower\n\nWould you like me to help troubleshoot this issue?`;
          
          if (callback) {
            callback({ text: errorResponse });
          }
          return { text: errorResponse, success: false };
        }
      }
      
      // If we get here, the input wasn't recognized
      const response = '❌ Please specify a valid amount (e.g., "100"), "max" for maximum, or "confirm" to execute the transaction.';
      
      if (callback) {
        callback({ text: response });
      }
      return { text: response, success: false };
      
    } catch (error) {
      elizaLogger.error('Error executing staking transaction:', error);
      
      const errorMessage = `❌ Failed to execute staking transaction: ${error instanceof Error ? error.message : 'Unknown error'}`;
      
      if (callback) {
        callback({ text: errorMessage });
      }
      return { text: errorMessage, success: false };
    }
  },
  
  examples: [
    [
      {
        user: '{{user1}}',
        content: { text: '1000' },
      },
      {
        name: '{{agentName}}',
        content: {
          text: 'Confirming stake of 1000 tokens. Please review the transaction details and type "confirm" to proceed.',
          action: 'EXECUTE_STAKING',
        },
      },
    ],
    [
      {
        user: '{{user1}}',
        content: { text: 'confirm' },
      },
      {
        user: '{{agentName}}',
        content: {
          text: 'Executing staking transaction...',
          action: 'EXECUTE_STAKING',
        },
      },
    ],
  ] as ActionExample[][],
};

// Helper Functions
async function executeStakingTransaction(
  runtime: IAgentRuntime, 
  params: {
    protocol: string;
    token: string;
    amount: string;
    tokenAddress: string;
    stakingContract?: string;
    chain: string;
  }
): Promise<StakingTransactionResult> {
  try {
    elizaLogger.info(`Executing staking transaction with params:${params}`,);
    
    // Get GOAT plugin tools from the runtime
    const goatPlugin = runtime.plugins?.find(plugin => plugin.name === 'goat');
    
    if (!goatPlugin) {
      throw new Error('GOAT plugin not found. Please ensure the GOAT plugin is properly installed.');
    }
    
    // Get the wallet connector and tools
    const tools = await goatPlugin.actions?.[0]?.handler?.(runtime, {} as Memory) as any;
    
    if (!tools) {
      throw new Error('Failed to get GOAT tools from plugin');
    }
    
    elizaLogger.info(`Available GOAT tools: ${Object.keys(tools)}`,);
    
    // Check if we need to approve token spending first (for non-native tokens)
    if (params.token !== 'ETH' && tools.erc20?.approve) {
      elizaLogger.info(`Approving ${params.token} spending...`);
      
      try {
        const approveParams = {
          tokenAddress: params.tokenAddress,
          spender: params.stakingContract || params.tokenAddress, // Fallback to token address
          amount: params.amount,
        };
        
        const approveResult = await tools.erc20.approve(approveParams);
        elizaLogger.info('Approval transaction result:', approveResult);
        
        if (!approveResult.hash) {
          throw new Error('Approval transaction failed - no hash returned');
        }
      } catch (approveError) {
        elizaLogger.error('Token approval failed:', approveError);
        throw new Error(`Token approval failed: ${approveError instanceof Error ? approveError.message : 'Unknown error'}`);
      }
    }
    
    // Execute staking based on protocol
    let stakingResult;
    
    switch (params.protocol.toLowerCase()) {
      case 'aave':
        if (tools.aave?.supply) {
          stakingResult = await tools.aave.supply({
            tokenAddress: params.tokenAddress,
            amount: params.amount,
          });
        } else {
          throw new Error('Aave tools not available in GOAT plugin');
        }
        break;
        
      case 'compound':
        if (tools.compound?.supply) {
          stakingResult = await tools.compound.supply({
            tokenAddress: params.tokenAddress,
            amount: params.amount,
          });
        } else {
          throw new Error('Compound tools not available in GOAT plugin');
        }
        break;
        
      case 'lido':
        if (tools.lido?.stake && params.token === 'ETH') {
          stakingResult = await tools.lido.stake({
            amount: params.amount,
          });
        } else {
          throw new Error('Lido staking not available or invalid token');
        }
        break;
        
      default:
        // Generic ERC20 transfer or contract interaction
        if (tools.erc20?.transfer) {
          stakingResult = await tools.erc20.transfer({
            tokenAddress: params.tokenAddress,
            to: params.stakingContract || params.tokenAddress,
            amount: params.amount,
          });
        } else {
          throw new Error(`Protocol ${params.protocol} not supported yet`);
        }
    }
    
    if (!stakingResult?.hash) {
      throw new Error('Staking transaction failed - no hash returned');
    }
    
    return {
      success: true,
      hash: stakingResult.hash,
      gasUsed: stakingResult.gasUsed?.toString(),
      gasPrice: stakingResult.gasPrice?.toString(),
    };
    
  } catch (error) {
    elizaLogger.error('Staking transaction execution failed:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

async function checkWalletBalances(runtime: IAgentRuntime, address: string): Promise<WalletBalance[]> {
  try {
    const balances: WalletBalance[] = [];
    
    // Get GOAT plugin tools
    const goatPlugin = runtime.plugins?.find(plugin => plugin.name === 'goat');
    const tools = await goatPlugin?.actions?.[0]?.handler?.(runtime, {} as Memory) as any;
    
    if (!tools) {
      elizaLogger.warn('GOAT tools not available for balance checking');
      return balances;
    }
    
    elizaLogger.info(`Available tools for balance checking: ${Object.keys(tools)}`,);
    
    // Check ETH balance
    if (tools.wallet?.getBalance) {
      try {
        const ethBalance = await tools.wallet.getBalance({ address });
        if (parseFloat(ethBalance) > 0) {
          balances.push({
            token: 'ETH',
            balance: ethBalance,
            tokenAddress: 'native',
            decimals: 18,
          });
        }
      } catch (error) {
        elizaLogger.warn('Failed to check ETH balance:', error);
      }
    }
    
    // Check common ERC20 token balances
    if (tools.erc20?.balanceOf) {
      const commonTokens = [
        { name: 'USDC', address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', decimals: 6 },
        { name: 'USDT', address: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', decimals: 6 },
        { name: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
      ];
      
      for (const token of commonTokens) {
        try {
          const balance = await tools.erc20.balanceOf({
            tokenAddress: token.address,
            account: address,
          });
          
          if (parseFloat(balance) > 0) {
            balances.push({
              token: token.name,
              balance: balance,
              tokenAddress: token.address,
              decimals: token.decimals,
            });
          }
        } catch (error) {
          elizaLogger.warn(`Failed to check ${token.name} balance:`, error);
        }
      }
    }
    
    return balances;
  } catch (error) {
    elizaLogger.error('Error checking wallet balances:', error);
    return [];
  }
}





async function getPreviousOpportunities(runtime: IAgentRuntime, message: Memory): Promise<StakingOpportunity[]> {
  try {
    // Try to get opportunities from recent memories
    const recentMemories = await runtime.getMemories({
      roomId: message.roomId,
      count: 10,
      tableName: "memories", // Added required tableName parameter
    });
    
    // Look for previous analysis results
    for (const memory of recentMemories) {
      const content = memory.content;
      
      // Check for opportunities using the dynamic properties we set in actions
      if (content.opportunities) {
        return content.opportunities as StakingOpportunity[];
      }
      
      // Check for testnetAnalysis data
      if (content.testnetAnalysis) {
        const analysis = content.testnetAnalysis as any;
        const opportunities = extractStakingOpportunitiesFromAnalysis(analysis);
        if (opportunities.length > 0) {
          return opportunities;
        }
      }
      
      // Check in nested data object as fallback
      if (content.data && typeof content.data === 'object') {
        const data = content.data as any;
        if (data.opportunities) {
          return data.opportunities as StakingOpportunity[];
        }
        if (data.analysis) {
          const opportunities = extractStakingOpportunitiesFromAnalysis(data.analysis);
          if (opportunities.length > 0) {
            return opportunities;
          }
        }
      }
      
      // Parse text content for staking opportunities
      if (content.text?.includes('🎯 Testnet Staking Opportunities:') || 
          content.text?.includes('Available Staking Opportunities')) {
        
        const opportunities = parseStakingOpportunitiesFromText(content.text);
        if (opportunities.length > 0) {
          return opportunities;
        }
      }
    }
    
    return [];
  } catch (error) {
    elizaLogger.error('Error getting previous opportunities:', error);
    return [];
  }
}

async function getSelectedOpportunity(runtime: IAgentRuntime, message: Memory): Promise<StakingOpportunity | null> {
  try {
    // Using getMemories instead of messageManager.getMemories with proper parameters
    const recentMemories = await runtime.getMemories({
      roomId: message.roomId,
      count: 5,
      tableName: "memories", // Added required tableName parameter
    });
    
    for (const memory of recentMemories) {
      const content = memory.content;
      
      // Check for selectedOpportunity using dynamic properties we set in actions
      if (content.selectedOpportunity) {
        return content.selectedOpportunity as StakingOpportunity;
      }
      
      // Check for opportunities array and return the first one (if it represents selection)
      if (content.opportunities && Array.isArray(content.opportunities)) {
        const opportunities = content.opportunities as StakingOpportunity[];
        if (opportunities.length > 0) {
          return opportunities[0]; // Return first opportunity as selected
        }
      }
      
      // Check in nested data object as fallback
      if (content.data && typeof content.data === 'object') {
        const data = content.data as any;
        if (data.selectedOpportunity) {
          return data.selectedOpportunity as StakingOpportunity;
        }
        if (data.opportunities && Array.isArray(data.opportunities) && data.opportunities.length > 0) {
          return data.opportunities[0] as StakingOpportunity;
        }
      }
      
      // Parse from text content if needed
      if (content.text?.includes('selected opportunity') || 
          content.text?.includes('Protocol:')) {
        const selected = parseSelectedOpportunityFromText(content.text);
        if (selected) {
          return selected;
        }
      }
    }
    
    return null;
  } catch (error) {
    elizaLogger.error('Error getting selected opportunity:', error);
    return null;
  }
}

async function getStakingDataForConfirmation(runtime: IAgentRuntime, message: Memory): Promise<{ amount: string } | null> {
  try {
    const recentMemories = await runtime.getMemories({
      roomId: message.roomId,
      count: 3,
      tableName: "memories", // Added required tableName parameter
    });
    
    for (const memory of recentMemories) {
      const content = memory.content;
      
      // Check for amount using dynamic properties we set in actions
      if (content.amount) {
        return { amount: content.amount as string };
      }
      
      // Check for stakingAmount property
      if (content.stakingAmount) {
        return { amount: content.stakingAmount as string };
      }
      
      // Check if we can extract amount from walletAddress context
      if (content.walletAddress && content.testnetAnalysis) {
        // Try to get recommended amount from analysis
        const analysis = content.testnetAnalysis as any;
        if (analysis.recommendedAmount) {
          return { amount: analysis.recommendedAmount as string };
        }
      }
      
      // Check opportunities for balance/amount info
      if (content.opportunities && Array.isArray(content.opportunities)) {
        const opportunities = content.opportunities as StakingOpportunity[];
        if (opportunities.length > 0 && opportunities[0].balance) {
          return { amount: opportunities[0].balance };
        }
      }
      
      // Check in nested data object as fallback
      if (content.data && typeof content.data === 'object') {
        const data = content.data as any;
        if (data.amount) {
          return { amount: data.amount as string };
        }
        if (data.stakingAmount) {
          return { amount: data.stakingAmount as string };
        }
      }
      
      // Parse from text content - look for amount patterns
      if (content.text) {
        const amountMatch = content.text.match(/Amount:\s*([0-9.]+\s*[A-Z]+)/i) ||
                           content.text.match(/stake\s+([0-9.]+\s*[A-Z]+)/i) ||
                           content.text.match(/([0-9.]+)\s*ETH/i);
        
        if (amountMatch) {
          return { amount: amountMatch[1].trim() };
        }
      }
    }
    
    return null;
  } catch (error) {
    elizaLogger.error('Error getting staking data for confirmation:', error);
    return null;
  }
}

// Alternative implementation using getMemoriesByRoomIds for better performance
async function getPreviousOpportunitiesOptimized(runtime: IAgentRuntime, message: Memory): Promise<StakingOpportunity[]> {
  try {
    // More efficient for single room queries
    const recentMemories = await runtime.getMemoriesByRoomIds({
      tableName: "memories",
      roomIds: [message.roomId],
      limit: 10,
    });
    
    // Look for previous analysis results
    for (const memory of recentMemories) {
      const content = memory.content;
      
      // Check for opportunities using the dynamic properties we set in actions
      if (content.opportunities) {
        return content.opportunities as StakingOpportunity[];
      }
      
      // Check for testnetAnalysis data
      if (content.testnetAnalysis) {
        const analysis = content.testnetAnalysis as any;
        const opportunities = extractStakingOpportunitiesFromAnalysis(analysis);
        if (opportunities.length > 0) {
          return opportunities;
        }
      }
      
      // Check in nested data object as fallback
      if (content.data && typeof content.data === 'object') {
        const data = content.data as any;
        if (data.opportunities) {
          return data.opportunities as StakingOpportunity[];
        }
        if (data.analysis) {
          const opportunities = extractStakingOpportunitiesFromAnalysis(data.analysis);
          if (opportunities.length > 0) {
            return opportunities;
          }
        }
      }
    }
    
    return [];
  } catch (error) {
    elizaLogger.error('Error getting previous opportunities (optimized):', error);
    return [];
  }
}

// Helper function to parse staking opportunities from text content
function parseStakingOpportunitiesFromText(text: string): StakingOpportunity[] {
  const opportunities: StakingOpportunity[] = [];
  
  try {
    // Look for Test ETH Staking pattern from your example
    const ethStakingMatch = text.match(/Test ETH Staking\s*•\s*Amount:\s*([0-9.]+)\s*ETH\s*•\s*Protocol:\s*([^•]+)•\s*Test APR:\s*([0-9.]+)%/i);
    
    if (ethStakingMatch) {
      opportunities.push({
        protocol: ethStakingMatch[2].trim(),
        token: 'ETH',
        apy: parseFloat(ethStakingMatch[3]),
        balance: ethStakingMatch[1],
        chain: 'sepolia', // Based on your example
        tokenAddress: '',
        stakingContract: '',
        description: 'Test liquid staking with Lido on Sepolia',
      });
    }
    
    // Add more parsing patterns as needed for different opportunity formats
    
  } catch (error) {
    elizaLogger.error('Error parsing staking opportunities from text:', error);
  }
  
  return opportunities;
}

// Helper function to parse selected opportunity from text
function parseSelectedOpportunityFromText(text: string): StakingOpportunity | null {
  try {
    // Look for protocol mentions and extract relevant data
    const protocolMatch = text.match(/Protocol:\s*([^•\n]+)/i);
    const amountMatch = text.match(/Amount:\s*([0-9.]+\s*[A-Z]+)/i);
    const aprMatch = text.match(/APR:\s*([0-9.]+)%/i);
    
    if (protocolMatch) {
      const token = amountMatch ? amountMatch[1].split(' ')[1] : 'ETH';
      const balance = amountMatch ? amountMatch[1].split(' ')[0] : '0';
      
      return {
        protocol: protocolMatch[1].trim(),
        token: token,
        apy: aprMatch ? parseFloat(aprMatch[1]) : 0,
        balance: balance,
        chain: text.includes('sepolia') ? 'sepolia' : 'ethereum',
        tokenAddress: '',
        stakingContract: '',
        description: '',
      };
    }
    
    return null;
  } catch (error) {
    elizaLogger.error('Error parsing selected opportunity from text:', error);
    return null;
  }
}

// Helper function to extract opportunities from analysis
function extractStakingOpportunitiesFromAnalysis(analysis: any): StakingOpportunity[] {
  // This would parse your analysis object to create opportunities
  // Adjust based on your actual analysis structure
  const opportunities: StakingOpportunity[] = [];
  
  if (analysis.testnetBalances) {
    // Example: Create ETH staking opportunity if user has testnet ETH
    const ethBalance = analysis.testnetBalances.sepolia?.eth;
    if (ethBalance && parseFloat(ethBalance) > 0.001) {
      opportunities.push({
        protocol: "Testnet Lido",
        token: "ETH",
        apy: 2.5,
        balance: (parseFloat(ethBalance) * 0.4).toFixed(6), // Recommend 40% of balance
        chain: "sepolia",
        tokenAddress: "",
        stakingContract: "",
        description: "Test liquid staking with Lido on Sepolia - practice the full staking flow"
      });
    }
  }
  
  return opportunities;
}





// Export the actions
export { 
  selectStakingAction, 
  executeStakingAction, 
  checkWalletBalances,
  executeStakingTransaction,
  type StakingOpportunity,
  type StakingTransactionResult,
  type WalletBalance
};