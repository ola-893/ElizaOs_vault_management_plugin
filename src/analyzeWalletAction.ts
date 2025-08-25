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

import { WalletAnalyzer, Validator } from './wallet-analyzer.ts';

import type {
  WalletAnalysis,
  StakingRecommendation,
  TokenHolding,
  StakingOption,
  BehaviorPattern,
  WalletRiskProfile,
  StakingStrategy,
} from './wallet-analyzer.ts';

//interfaces for staking opportunities and transaction results
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
  isTestnet?: boolean;
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

  // Testnet bonus for testing purposes
  if (recommendation.isTestnet) {
    score += 5; // Small bonus for testnet opportunities when in testnet mode
  }

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

  //testnet-specific reasoning
  if (rec.isTestnet) {
    reasons.push("Great for testing staking strategies risk-free");
  }

  return reasons.length > 0 ? reasons.join(", ") : "Good fit for your portfolio";
}

function generateActionableInsights(analysis: WalletAnalysis): string[] {
  const insights: string[] = [];
  const hasTestnetTokens = analysis.tokenHoldings.some(token => token.isTestnet);

  // Portfolio balance insights
  const totalBalance = parseFloat(analysis.totalBalance);
  if (totalBalance > 5) {
    insights.push("💰 Consider liquid staking for your large ETH holdings to earn passive yield");
  } else if (totalBalance > 0.1) {
    insights.push("🌱 Perfect balance size to start with liquid staking protocols");
  } else if (hasTestnetTokens) {
    insights.push("🧪 Great testnet holdings for practicing staking strategies");
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
    const testnetStables = stablecoins.filter(token => token.isTestnet);
    if (testnetStables.length > 0) {
      insights.push("🧪 Your testnet stablecoins are perfect for testing lending protocols");
    } else {
      insights.push("🏦 Your stablecoins can earn yield through lending protocols");
    }
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

  // Testnet-specific insights
  if (hasTestnetTokens) {
    insights.push("🔬 Testnet activity shows you're serious about testing before mainnet");
    insights.push("📚 Use testnet experience to validate staking strategies");
  }

  return insights;
}

function generateRiskWarnings(analysis: WalletAnalysis): string[] {
  const warnings: string[] = [];
  const hasTestnetTokens = analysis.tokenHoldings.some(token => token.isTestnet);

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
  if (totalBalance < 0.1 && !hasTestnetTokens) {
    warnings.push("💸 Small portfolio size - focus on building holdings before complex strategies");
  }

  // Gas cost warnings
  if (totalBalance < 1 && analysis.tokenHoldings.length > 5) {
    warnings.push("⛽ High token count vs balance - consider gas costs for staking transactions");
  }

  // Testnet-specific warnings
  if (hasTestnetTokens) {
    warnings.push("🧪 Remember: testnet tokens have no real value - use only for learning");
    warnings.push("🔄 Testnets can reset - don't rely on persistent state");
    warnings.push("📡 Testnet RPC endpoints may be less reliable than mainnet");
  }

  return warnings;
}


// UPDATED QUICK STAKING CHECK ACTION with testnet support
const quickStakingCheckAction: Action = {
  name: "QUICK_STAKING_CHECK",
  similes: [
    "quick staking check",
    "staking opportunities",
    "what can I stake",
    "stakeable assets",
    "earn yield",
    "passive income",
    "quick testnet check"
  ],
  description: "Quickly identify stakeable assets in user's wallet and provide immediate opportunities (supports testnet)",
  
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
      const isTestnetRequest = Validator.isTestnetRequest(message.content.text || '');

      if (!walletAddress) {
        const response = `🔍 **Quick Staking Opportunities Check${isTestnetRequest ? ' (Testnet)' : ''}**\n\n` +
                        "Please provide your wallet address to check for immediate staking opportunities!\n\n" +
                        `Example: \`Quick staking check for 0x742d35Cc6654C2cFc2B28B44E8D9c8C0E4cB9fcE\``;
        
        if (callback) {
          callback({ text: response });
        }
        return { text: response, success: true };
      }

      const walletAnalyzer = new WalletAnalyzer();
      const analysis = await walletAnalyzer.analyzeWallet(runtime, walletAddress, isTestnetRequest);

      const response = generateQuickStakingResponse(analysis, isTestnetRequest);

      const result: ActionResult = {
        text: response,
        success: true,
        data: { quickAnalysis: analysis, isTestnet: isTestnetRequest }
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
    [
      {
        user: "{{user1}}",
        content: { text: "Quick testnet staking check for 0x456...def" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "🧪 Checking your testnet wallet for testing staking opportunities...",
          action: "QUICK_STAKING_CHECK",
        },
      },
    ],
  ] as ActionExample[][],
};

// RISK ASSESSMENT ACTION - Enhanced with testnet support
const riskAssessmentAction: Action = {
  name: "ASSESS_STAKING_RISK",
  similes: [
    "risk assessment",
    "how risky",
    "safe to stake",
    "risk profile",
    "staking risks",
    "is it safe",
    "testnet risks"
  ],
  description: "Assess staking risks for user's portfolio and provide risk-adjusted recommendations (supports testnet)",
  
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
      const isTestnetRequest = Validator.isTestnetRequest(message.content.text || '');

      if (!walletAddress) {
        const response = `⚖️ **Staking Risk Assessment${isTestnetRequest ? ' (Testnet)' : ''}**\n\n` +
                        "Provide your wallet address for a personalized risk assessment!\n\n" +
                        "I'll analyze your portfolio and suggest risk-appropriate staking strategies.";
        
        if (callback) {
          callback({ text: response });
        }
        return { text: response, success: true };
      }

      const walletAnalyzer = new WalletAnalyzer();
      const analysis = await walletAnalyzer.analyzeWallet(runtime, walletAddress, isTestnetRequest);

      const response = generateRiskAssessmentResponse(analysis, isTestnetRequest);

      const result: ActionResult = {
        text: response,
        success: true,
        data: { riskAnalysis: analysis.riskProfile, isTestnet: isTestnetRequest }
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
  warnings: string[],
  isTestnetMode: boolean = false
): string {
  let response = `🧠 **Comprehensive Wallet Analysis & Personalized Staking Strategy${isTestnetMode ? ' (Testnet)' : ''}**\n\n`;
  
  // Portfolio Overview
  response += `📊 **Portfolio Overview:**\n`;
  response += `• Address: ${analysis.address.slice(0, 6)}...${analysis.address.slice(-4)}\n`;
  response += `• Total Balance: ${parseFloat(analysis.totalBalance).toFixed(9)} ETH\n`;
  response += `• Token Holdings: ${analysis.tokenHoldings.length} tokens\n`;
  response += `• Active Chains: ${Object.keys(analysis.nativeBalances).length}\n`;
  response += `• Diversification Score: ${analysis.diversificationScore}/100\n`;
  response += `• Current Staking: ${analysis.currentStakingPositions.length} positions\n`;
  
  if (isTestnetMode) {
    const testnetTokens = analysis.tokenHoldings.filter(t => t.isTestnet);
    const testnetChains = Object.keys(analysis.nativeBalances).filter(chain => 
      analysis.tokenHoldings.some(t => t.chainName === chain && t.isTestnet)
    );
    response += `• Testnet Tokens: ${testnetTokens.length}\n`;
    response += `• Testnet Chains: ${testnetChains.join(', ')}\n`;
  }
  response += '\n';
  
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
      const testnetFlag = rec.isTestnet ? '🧪 ' : '';
      response += `\n**${index + 1}. ${testnetFlag}${rec.token} Staking** (${rec.urgencyLevel} Priority)\n`;
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
    analysis.behaviorPatterns.slice(0, 3).forEach(pattern => {
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
    const testnetPrefix = topRec.isTestnet ? 'Test ' : '';
    response += `1. **Start Here**: ${testnetPrefix}Stake ${topRec.recommendedAmount} ${topRec.token} with ${topRec.options[0]?.protocol}\n`;
    response += `2. **Monitor**: Track performance and adjust based on ${isTestnetMode ? 'testnet' : 'market'} conditions\n`;
    response += `3. **Scale**: ${isTestnetMode ? 'Validate on testnet before' : 'Gradually increase allocation as you gain'} confidence\n`;
    response += `4. **Diversify**: Consider ${analysis.stakingStrategy.diversificationGoal} protocols for optimal risk management\n`;
  } else {
    if (isTestnetMode) {
      response += `1. **Get Testnet Tokens**: Use faucets to get testnet ETH and tokens\n`;
      response += `2. **Start Small**: Begin with minimal amounts for testing\n`;
      response += `3. **Test Workflows**: Practice staking and unstaking processes\n`;
    } else {
      response += `1. **Build Position**: Accumulate more ETH or stablecoins for staking\n`;
      response += `2. **Start Small**: Begin with liquid staking when you reach minimum thresholds\n`;
      response += `3. **Learn**: Research the recommended protocols while building your position\n`;
    }
  }

  if (isTestnetMode) {
    response += `\n🧪 **Testnet Testing Guidelines:**\n`;
    response += `• Use minimal amounts to test all workflows\n`;
    response += `• Document your testing process and findings\n`;
    response += `• Test error scenarios and edge cases\n`;
    response += `• Prepare mainnet strategy based on testnet experience\n`;
  }

  return response;
}

function generateQuickStakingResponse(analysis: WalletAnalysis, isTestnet: boolean = false): string {
  let response = `🔍 **Quick Staking Opportunities Check${isTestnet ? ' (Testnet)' : ''}**\n\n`;
  
  const ethBalance = parseFloat(analysis.totalBalance);
  const stakeableTokens = analysis.tokenHoldings.filter(token => token.isStakeable);
  const immediateOpportunities = analysis.stakingRecommendations.filter(rec => 
    rec.priority === "HIGH" || rec.priority === "MEDIUM"
  );

  response += `**🎯 Immediate Opportunities:**\n`;
  
  if (ethBalance > 0.01) {
    const testnetLabel = isTestnet ? 'Test ' : '';
    response += `• **${testnetLabel}ETH Liquid Staking**: ${ethBalance.toFixed(9)} ETH ready\n`;
    
    if (isTestnet) {
      response += `  → Start with Testnet Lido (2.5% APR) or Testnet Rocket Pool (2.3% APR)\n`;
    } else {
      response += `  → Start with Lido (3.2% APR) or Rocket Pool (3.1% APR)\n`;
    }
  }

  if (stakeableTokens.length > 0) {
    stakeableTokens.slice(0, 3).forEach(token => {
      const testnetLabel = token.isTestnet ? '🧪 Test ' : '';
      response += `• **${testnetLabel}${token.symbol} Lending**: ${token.balance} ${token.symbol} available\n`;
      if (token.stakingOptions && token.stakingOptions[0]) {
        response += `  → ${token.stakingOptions[0].protocol} (${token.stakingOptions[0].expectedApr}% APR)\n`;
      }
    });
  }

  if (immediateOpportunities.length === 0 && ethBalance < 0.01) {
    if (isTestnet) {
      response += `• **Get Testnet Tokens**: Use faucets to get testnet ETH for testing\n`;
      response += `• **Practice Staking**: Start with smallest possible amounts\n`;
    } else {
      response += `• **Build Position**: Accumulate 0.1+ ETH to start liquid staking\n`;
      response += `• **Stablecoin Strategy**: Consider USDC/DAI for lending yield\n`;
    }
  }

  response += `\n**📊 Quick Stats:**\n`;
  response += `• Stakeable Assets: ${stakeableTokens.length}\n`;
  response += `• Total Staking Capacity: ${analysis.liquidityNeeds.stakingCapacity.toFixed(9)} ETH\n`;
  response += `• Risk Level: ${analysis.riskProfile.stakingRiskTolerance}\n`;

  if (isTestnet) {
    const testnetTokens = analysis.tokenHoldings.filter(t => t.isTestnet);
    response += `• Testnet Tokens: ${testnetTokens.length}\n`;
  }

  if (immediateOpportunities.length > 0) {
    response += `\n**🚀 Top Quick Win:**\n`;
    const topOpp = immediateOpportunities[0];
    const testnetLabel = topOpp.isTestnet ? '🧪 Test ' : '';
    response += `${testnetLabel}${topOpp.token}: ${topOpp.recommendedAmount} → ${topOpp.expectedReturn} annually\n`;
  }

  response += `\n💡 *Use "analyze my ${isTestnet ? 'testnet ' : ''}wallet [address]" for detailed strategy*`;

  return response;
}

function generateRiskAssessmentResponse(analysis: WalletAnalysis, isTestnet: boolean = false): string {
  let response = `⚖️ **Comprehensive Staking Risk Assessment${isTestnet ? ' (Testnet)' : ''}**\n\n`;
  
  const riskProfile = analysis.riskProfile;
  
  response += `**📊 Overall Risk Score: ${riskProfile.riskScore}/100**\n\n`;
  
  if (isTestnet) {
    response += `🧪 **Testnet Risk Context:**\n`;
    response += `• No real financial risk - perfect for learning\n`;
    response += `• Focus on workflow and process validation\n`;
    response += `• Test edge cases and error scenarios\n\n`;
  }
  
  // Risk Level Interpretation
  response += `**🎯 Risk Profile: ${riskProfile.riskTolerance}**\n`;
  if (riskProfile.riskTolerance === 'CONSERVATIVE') {
    response += isTestnet 
      ? `• Test blue-chip liquid staking protocols (Testnet Lido, Coinbase)\n`
      : `• Stick to blue-chip liquid staking (Lido, Coinbase)\n`;
    response += `• Maximum 40% portfolio allocation to staking\n`;
    response += `• Avoid lock periods > 7 days\n`;
  } else if (riskProfile.riskTolerance === 'MODERATE') {
    response += `• Balanced approach with established protocols\n`;
    response += `• Up to 60% allocation across 2-3 protocols\n`;
    response += `• Lock periods up to 30 days acceptable\n`;
  } else if (riskProfile.riskTolerance === 'AGGRESSIVE') {
    response += isTestnet
      ? `• Test high-yield opportunities and newer protocols\n`
      : `• Explore high-yield opportunities (EigenLayer, newer protocols)\n`;
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
  if (totalBalance < 1 && !isTestnet) {
    response += `• **Small Portfolio Risk**: Gas costs may impact returns\n`;
    response += `  → Focus on single high-quality protocol to minimize fees\n`;
  } else if (totalBalance > 50) {
    response += `• **Large Portfolio Advantage**: Can diversify effectively ✅\n`;
  }

  if (isTestnet) {
    response += `• **Testnet-Specific Risks**:\n`;
    response += `  → Network resets can cause data loss\n`;
    response += `  → RPC endpoints may be unreliable\n`;
    response += `  → Different gas dynamics than mainnet\n`;
  }

  response += `\n**🛡️ Risk Mitigation Strategy:**\n`;
  response += `• Max Single Position: ${riskProfile.maxSinglePosition} ETH\n`;
  response += `• Emergency Buffer: ${analysis.liquidityNeeds.emergencyBuffer.toFixed(9)} ETH\n`;
  response += `• Recommended Lock Period: ≤ ${riskProfile.lockPeriodTolerance} days\n`;

  if (isTestnet) {
    response += `• Testing Approach: Start with minimal amounts\n`;
    response += `• Documentation: Record all test scenarios and results\n`;
  }

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
      const testnetLabel = rec.isTestnet ? '🧪 ' : '';
      response += `${index + 1}. ${testnetLabel}${rec.token} via ${rec.options[0]?.protocol} (${rec.options[0]?.riskLevel} risk)\n`;
      response += `   💰 Amount: ${rec.recommendedAmount} ${rec.token}\n`;
      response += `   📈 Expected: ${rec.expectedReturn}\n`;
    });
  } else {
    if (isTestnet) {
      response += `• Get testnet tokens from faucets to start testing\n`;
      response += `• Focus on understanding protocol mechanics\n`;
    } else {
      response += `• Build larger position before staking (current: ${totalBalance.toFixed(9)} ETH)\n`;
      response += `• Start with stablecoin lending for lower-risk yield\n`;
    }
  }

  response += `\n**📋 Risk Management Checklist:**\n`;
  if (isTestnet) {
    response += `□ Never stake more than ${riskProfile.maxSinglePosition} ETH in one protocol\n`;
    response += `□ Start with liquid staking before locked positions\n`;
    response += `□ Research protocol audits and track record\n`;
    response += `□ Monitor staking positions regularly\n`;
  }

  return response;
}

// Helper function for testnet-specific response
function generateTestnetAnalysisResponse(analysis: WalletAnalysis): string {
  const testnetTokens = analysis.tokenHoldings.filter(token => token.isTestnet);
  const testnetChains = Object.keys(analysis.nativeBalances).filter(chain => {
    // Check if any tokens on this chain are testnet tokens
    return analysis.tokenHoldings.some(token => token.chainName === chain && token.isTestnet) ||
           ['sepolia', 'goerli', 'baseGoerli', 'arbitrumGoerli', 'polygonMumbai', 'optimismGoerli'].includes(chain);
  });

  let response = `🧪 **TESTNET WALLET ANALYSIS**\n\n`;
  
  response += `**📊 Testnet Portfolio Overview:**\n`;
  response += `• Address: ${analysis.address.slice(0, 6)}...${analysis.address.slice(-4)}\n`;
  response += `• Testnet Chains: ${testnetChains.length} (${testnetChains.join(', ')})\n`;
  response += `• Testnet Tokens: ${testnetTokens.length}\n`;
  response += `• Total Test ETH: ${analysis.totalBalance} ETH\n\n`;

  if (testnetTokens.length > 0) {
    response += `**🪙 Testnet Token Holdings:**\n`;
    testnetTokens.forEach(token => {
      response += `• ${token.symbol}: ${token.balance} (${token.chainName})\n`;
      if (token.isStakeable && token.stakingOptions?.length) {
        response += `  → Stakeable via ${token.stakingOptions[0].protocol}\n`;
      }
    });
    response += '\n';
  }

  // Show native balances on testnet chains
  const testnetNativeBalances = Object.entries(analysis.nativeBalances).filter(([chain]) => 
    testnetChains.includes(chain)
  );
  
  if (testnetNativeBalances.length > 0) {
    response += `**⛽ Native Testnet Balances:**\n`;
    testnetNativeBalances.forEach(([chain, balance]) => {
      response += `• ${chain}: ${parseFloat(balance).toFixed(9)} ETH\n`;
    });
    response += '\n';
  }

  // Testnet staking opportunities
  const testnetRecommendations = analysis.stakingRecommendations.filter(rec => 
    rec.isTestnet || rec.options[0]?.chainName && testnetChains.includes(rec.options[0].chainName)
  );

  if (testnetRecommendations.length > 0) {
    response += `**🎯 Testnet Staking Opportunities:**\n`;
    testnetRecommendations.forEach((rec, index) => {
      response += `\n${index + 1}. **Test ${rec.token} Staking**\n`;
      response += `   • Amount: ${rec.recommendedAmount} ${rec.token}\n`;
      response += `   • Protocol: ${rec.options[0]?.protocol}\n`;
      response += `   • Test APR: ${rec.options[0]?.expectedApr}%\n`;
      response += `   • Risk Level: ${rec.options[0]?.riskLevel}\n`;
      response += `   • Purpose: ${rec.options[0]?.description}\n`;
    });
    response += '\n';
  }

  // Testnet behavior patterns
  const testnetPatterns = analysis.behaviorPatterns.filter(pattern => 
    pattern.pattern.toLowerCase().includes('testnet')
  );
  
  if (testnetPatterns.length > 0) {
    response += `**🎭 Testnet Behavior Analysis:**\n`;
    testnetPatterns.forEach(pattern => {
      response += `• ${pattern.pattern}: ${pattern.description}\n`;
      if (pattern.stakingImplication) {
        response += `  💡 Testing Insight: ${pattern.stakingImplication}\n`;
      }
    });
    response += '\n';
  }

  response += `**🧪 Testing Guidelines:**\n`;
  response += `• Start with smallest possible amounts to test workflows\n`;
  response += `• Test all protocol interactions thoroughly (stake, unstake, claim)\n`;
  response += `• Verify gas cost estimations for mainnet planning\n`;
  response += `• Test edge cases and error scenarios\n`;
  response += `• Document all processes for mainnet implementation\n`;
  response += `• Practice emergency procedures and error recovery\n\n`;

  response += `**📚 Learning Opportunities:**\n`;
  if (testnetTokens.length > 0) {
    response += `• Test lending protocols with your ${testnetTokens.filter(t => t.isStakeable).length} stakeable tokens\n`;
  }
  if (parseFloat(analysis.totalBalance) > 0.01) {
    response += `• Practice liquid staking with your ${analysis.totalBalance} test ETH\n`;
  }
  response += `• Experiment with multi-chain staking strategies\n`;
  response += `• Test protocol governance and voting mechanisms\n`;
  response += `• Validate transaction batching and optimization\n\n`;

  response += `**⚠️ Testnet Disclaimers:**\n`;
  response += `• ❌ Testnet tokens have NO real value\n`;
  response += `• 🔄 Networks may reset, losing all data\n`;
  response += `• ⚡ Gas dynamics may differ from mainnet\n`;
  response += `• 📡 RPC endpoints may be unreliable\n`;
  response += `• 🎯 Use only for learning and validation\n`;
  response += `• 🔍 Smart contracts may have different addresses on mainnet\n\n`;

  response += `**📋 Testnet Action Plan:**\n`;
  response += `1. **Get More Tokens**: Use faucets if you need more testnet ETH/tokens\n`;
  response += `2. **Test Basic Operations**: Start with transfers and approvals\n`;
  response += `3. **Try Smallest Stakes**: Use minimum amounts for initial staking tests\n`;
  response += `4. **Document Everything**: Keep detailed records of your testing\n`;
  response += `5. **Test Error Cases**: Intentionally trigger edge cases and errors\n`;
  response += `6. **Plan Mainnet**: Use testnet learnings to design mainnet strategy\n\n`;

  response += `**🚀 Graduation to Mainnet:**\n`;
  response += `• Once you're comfortable with testnet operations\n`;
  response += `• Have documented all procedures and gas costs\n`;
  response += `• Tested error recovery scenarios\n`;
  response += `• Ready to implement with real funds on mainnet\n`;

  return response;
}

// PORTFOLIO OPTIMIZATION ACTION - Enhanced with testnet support
const optimizePortfolioAction: Action = {
  name: "OPTIMIZE_STAKING_PORTFOLIO",
  similes: [
    "optimize portfolio",
    "improve staking",
    "better yields",
    "maximize returns",
    "portfolio optimization",
    "rebalance staking",
    "optimize testnet portfolio"
  ],
  description: "Analyze current staking positions and suggest optimizations for better risk-adjusted returns (supports testnet)",
  
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
      const isTestnetRequest = Validator.isTestnetRequest(message.content.text || '');

      if (!walletAddress) {
        const response = `🎯 **Portfolio Optimization Service${isTestnetRequest ? ' (Testnet)' : ''}**\n\n` +
                        "Provide your wallet address to analyze current positions and suggest optimizations!\n\n" +
                        "I'll help you maximize yield while managing risk appropriately.";
        
        if (callback) {
          callback({ text: response });
        }
        return { text: response, success: true };
      }

      const walletAnalyzer = new WalletAnalyzer();
      const analysis = await walletAnalyzer.analyzeWallet(runtime, walletAddress, isTestnetRequest);

      const response = generateOptimizationResponse(analysis, isTestnetRequest);

      const result: ActionResult = {
        text: response,
        success: true,
        data: { optimization: analysis, isTestnet: isTestnetRequest }
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
    [
      {
        user: "{{user1}}",
        content: { text: "Optimize my testnet staking portfolio 0x123...abc" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "🧪 Analyzing your testnet positions to optimize testing strategies...",
          action: "OPTIMIZE_STAKING_PORTFOLIO",
        },
      },
    ],
  ] as ActionExample[][],
};

function generateOptimizationResponse(analysis: WalletAnalysis, isTestnet: boolean = false): string {
  let response = `🎯 **Portfolio Optimization Analysis${isTestnet ? ' (Testnet)' : ''}**\n\n`;
  
  const currentStaking = analysis.currentStakingPositions;
  const totalBalance = parseFloat(analysis.totalBalance);
  const stakingCapacity = analysis.liquidityNeeds.stakingCapacity;
  
  response += `**📊 Current State:**\n`;
  response += `• Total Portfolio: ${totalBalance.toFixed(9)} ETH\n`;
  response += `• Currently Staked: ${currentStaking.length} positions\n`;
  response += `• Available to Stake: ${stakingCapacity.toFixed(9)} ETH\n`;
  response += `• Diversification: ${analysis.diversificationScore}/100\n`;
  
  if (isTestnet) {
    const testnetTokens = analysis.tokenHoldings.filter(t => t.isTestnet);
    response += `• Testnet Tokens: ${testnetTokens.length}\n`;
  }
  response += '\n';

  // Current staking analysis
  if (currentStaking.length > 0) {
    response += `**🔒 Current Staking Positions:**\n`;
    currentStaking.forEach(position => {
      const testnetLabel = position.isTestnet ? '🧪 ' : '';
      response += `• ${testnetLabel}${position.symbol}: ${position.balance} (${position.chainName})\n`;
    });
    response += '\n';
  }

  // Optimization opportunities
  response += `**⚡ Optimization Opportunities:**\n`;
  
  // Check for unstaked ETH
  if (totalBalance > 0.1 && currentStaking.length === 0) {
    const stakingAmount = totalBalance * 0.7;
    const expectedReturn = stakingAmount * (isTestnet ? 0.025 : 0.032);
    response += `🚀 **High Priority**: ${isTestnet ? 'Test ' : ''}Stake ${stakingAmount.toFixed(9)} ETH for ~${isTestnet ? '2.5' : '3.2'}% APR\n`;
    response += `   → Potential annual ${isTestnet ? 'test ' : ''}earnings: ${expectedReturn.toFixed(9)} ETH\n`;
  }

  // Check for suboptimal allocations
  const currentAllocation = currentStaking.reduce((sum, pos) => sum + parseFloat(pos.balance), 0);
  const optimalAllocation = totalBalance * (analysis.stakingStrategy.recommendedAllocation / 100);
  
  if (currentAllocation < optimalAllocation * 0.8) {
    const additional = optimalAllocation - currentAllocation;
    response += `📈 **Underallocated**: Consider ${isTestnet ? 'testing with' : 'staking'} additional ${additional.toFixed(9)} ETH\n`;
    response += `   → Current: ${((currentAllocation/totalBalance)*100).toFixed(1)}% | Optimal: ${analysis.stakingStrategy.recommendedAllocation}%\n`;
  }

  // Diversification improvements
  if (analysis.diversificationScore < 50 && totalBalance > (isTestnet ? 1 : 5)) {
    response += `🌐 **Diversification**: Spread across ${analysis.stakingStrategy.diversificationGoal} protocols\n`;
    response += `   → Reduces single protocol risk\n`;
  }

  // Yield improvements
  const stakeableTokens = analysis.tokenHoldings.filter(token => 
    token.isStakeable && parseFloat(token.balance) > (isTestnet ? 1 : 50)
  );
  
  if (stakeableTokens.length > 0) {
    response += `💰 **Idle Assets**: ${stakeableTokens.length} tokens earning 0% yield\n`;
    stakeableTokens.slice(0, 2).forEach(token => {
      const testnetLabel = token.isTestnet ? '🧪 ' : '';
      response += `   • ${testnetLabel}${token.symbol}: ${token.balance} → ${token.stakingOptions?.[0]?.expectedApr || 'N/A'}% APR available\n`;
    });
  }

  // Specific recommendations
  response += `\n**🎯 Optimization Plan:**\n`;
  
  const topRecommendations = analysis.stakingRecommendations
    .filter(rec => rec.priority === "HIGH" || rec.priority === "MEDIUM")
    .slice(0, 3);

  if (topRecommendations.length > 0) {
    topRecommendations.forEach((rec, index) => {
      const testnetLabel = rec.isTestnet ? '🧪 Test ' : '';
      response += `\n**Step ${index + 1}: ${testnetLabel}${rec.token} Optimization**\n`;
      response += `• ${isTestnet ? 'Test ' : ''}Stake: ${rec.recommendedAmount} ${rec.token}\n`;
      response += `• Protocol: ${rec.options[0]?.protocol} (${rec.options[0]?.expectedApr}% APR)\n`;
      response += `• Expected Return: ${rec.expectedReturn}\n`;
      response += `• Risk Level: ${rec.options[0]?.riskLevel}\n`;
      response += `• Why: ${rec.reasoning}\n`;
    });
  } else {
    if (isTestnet) {
      response += `• **Get Testnet Tokens**: Use faucets to get tokens for testing\n`;
      response += `• **Start Testing**: Focus on understanding protocol workflows\n`;
      response += `• **Document Process**: Record all testing procedures\n`;
    } else {
      response += `• **Build Position**: Focus on accumulating ETH for liquid staking\n`;
      response += `• **Target**: 0.1+ ETH minimum for cost-effective staking\n`;
      response += `• **Strategy**: DCA into ETH, then stake incrementally\n`;
    }
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

  if (isTestnet) {
    response += `• Enhanced Testing Coverage: Validate more protocols\n`;
    response += `• Better Mainnet Preparation: Documented workflows\n`;
    response += `• Risk Mitigation: Tested error scenarios\n`;
  }

  // Implementation timeline
  response += `\n**⏰ Implementation Timeline:**\n`;
  if (isTestnet) {
    response += `• **Day 1**: Test highest priority recommendation with minimal amounts\n`;
    response += `• **Week 1**: Validate all basic workflows (stake, unstake, claim)\n`;
    response += `• **Week 2**: Test edge cases and error scenarios\n`;
    response += `• **Week 3**: Document all procedures for mainnet\n`;
    response += `• **Week 4**: Prepare mainnet implementation strategy\n`;
  } else {
    response += `• **Week 1**: Start with highest priority recommendation\n`;
    response += `• **Week 2-4**: Gradually increase allocation to target %\n`;
    response += `• **Month 2**: Add secondary protocols for diversification\n`;
    response += `• **Ongoing**: Monitor and rebalance quarterly\n`;
  }

  // Risk considerations
  response += `\n**⚠️ Optimization Risks:**\n`;
  if (isTestnet) {
    response += `• Network instability may interrupt testing\n`;
    response += `• Testnet resets can lose progress\n`;
    response += `• Different behavior from mainnet protocols\n`;
    response += `• Time investment with no financial return\n`;
  } else {
    response += `• Smart contract risk in new protocols\n`;
    response += `• Liquidity risk if over-allocating to locked staking\n`;
    response += `• Gas costs for small position adjustments\n`;
    response += `• Market timing risk during transitions\n`;
  }

  if (isTestnet) {
    response += `\n**🎓 Learning Outcomes:**\n`;
    response += `• Validated staking workflows and procedures\n`;
    response += `• Documented gas costs and transaction patterns\n`;
    response += `• Tested error handling and recovery procedures\n`;
    response += `• Prepared comprehensive mainnet strategy\n`;
    response += `• Built confidence through hands-on experience\n`;
  }

  return response;
}

// DEDICATED TESTNET ANALYSIS ACTION
const testnetAnalysisAction: Action = {
  name: "ANALYZE_TESTNET_WALLET",
  similes: [
    "testnet analysis",
    "analyze testnet wallet",
    "test wallet analysis",
    "testnet staking",
    "sepolia analysis",
    "goerli analysis",
    "testnet wallet check"
  ],
  description: "Analyze testnet wallet and provide testnet-specific staking recommendations for testing purposes",
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';
    const hasWalletAddress = Validator.extractWalletAddress(text);
    
    return (text.includes("testnet") || text.includes("sepolia") || text.includes("goerli")) &&
           (text.includes("analyze") || text.includes("test")) &&
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
          text: "🧪 Please provide a valid wallet address for testnet analysis. Example: 0x742d35Cc6654C2cFc2B28B44E8D9c8C0E4cB9fcE",
          content: {
            text: "🧪 Please provide a valid wallet address for testnet analysis.",
            action: "ANALYZE_TESTNET_WALLET",
            errorType: "missing_wallet_address",
            isTestnet: true,
            requestedAction: "testnet_analysis"
          }
        };

        if (callback) {
          callback(errorResponse);
        }
        return;
      }

      elizaLogger.info(`🧪 Starting dedicated testnet analysis for ${walletAddress}`);
      
      const walletAnalyzer = new WalletAnalyzer();
      const analysis = await walletAnalyzer.analyzeWallet(runtime, walletAddress, true);

      if (!analysis) {
        throw new Error("Failed to analyze testnet wallet");
      }

      // Generate testnet-focused response
      const response = generateTestnetAnalysisResponse(analysis);

      // Extract opportunities from analysis for storage
      const opportunities = extractStakingOpportunitiesFromAnalysis(analysis);

      const result: ActionResult = {
        text: response,
        success: true,
        data: {
          testnetAnalysis: analysis,
          isTestnet: true
        }
      };

      if (callback) {
        callback({
          text: result.text,
          content: {
            text: result.text,
            action: "ANALYZE_TESTNET_WALLET",
            opportunities: opportunities, // Direct access via content.opportunities
            testnetAnalysis: analysis,    // Store full analysis
            walletAddress: walletAddress, // Store analyzed address
            isTestnet: true,              // Flag for testnet data
            analysisTimestamp: Date.now(), // When analysis was performed
            chain: "sepolia",             // Default testnet chain
            data: {                       // Nested data object as fallback
              opportunities: opportunities,
              analysis: analysis,
              isTestnet: true
            }
          },
          success: result.success,
          data: result.data
        });
      }

      return result;
    } catch (error) {
      elizaLogger.error("Error in testnet wallet analysis:", error);
      
      const errorMessage = "❌ Sorry, I encountered an error analyzing your testnet wallet. Please try again.";
      if (callback) {
        callback({ 
          text: errorMessage,
          content: {
            text: errorMessage,
            action: "ANALYZE_TESTNET_WALLET",
            errorType: "analysis_failed",
            isTestnet: true,
            error: error.message
          }
        });
      }
      
      return { text: errorMessage, success: false };
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "Analyze my testnet wallet 0x742d35Cc6654C2cFc2B28B44E8D9c8C0E4cB9fcE" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "🧪 Analyzing your testnet wallet for testing staking strategies...",
          action: "ANALYZE_TESTNET_WALLET",
        },
      },
    ],
  ] as ActionExample[][],
};

// Companion action for quick testnet recommendations
export const testnetStakingAction: Action = {
  name: "TESTNET_STAKING_GUIDE",
  similes: [
    "testnet staking",
    "how to test staking",
    "testnet staking guide",
    "practice staking",
    "test staking protocols"
  ],
  description: "Provide testnet staking guidance and recommendations",
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';
    return (text.includes("testnet") && text.includes("stak")) || 
           (text.includes("test") && text.includes("stak")) ||
           text.includes("practice staking");
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<void | ActionResult | undefined> => {
    const response = `🧪 **TESTNET STAKING GUIDE**

**🚰 Step 1: Get Testnet Tokens**
• Sepolia ETH: https://sepoliafaucet.com/
• Testnet USDC: https://faucet.circle.com/
• More faucets: https://faucetlink.to/sepolia

**🎯 Step 2: Choose Your Testing Strategy**

**Beginner Testing:**
• Start with 0.001 ETH on Sepolia
• Test Lido liquid staking (stETH)
• Practice approval transactions
• Learn unstaking process

**Intermediate Testing:**
• Get testnet USDC (100+)
• Test Aave lending protocols
• Practice collateral management
• Test liquidation scenarios

**Advanced Testing:**
• Multi-chain testing (Base Sepolia, Arbitrum Sepolia)
• Test yield farming on Uniswap
• Practice complex DeFi strategies
• Test emergency procedures

**🧪 Essential Test Cases:**
1. **Stake Small Amount**: Start with minimum amounts
2. **Monitor Rewards**: Check how rewards accrue
3. **Test Unstaking**: Practice withdrawal process
4. **Gas Estimation**: Document costs for mainnet
5. **Error Recovery**: Test failed transactions
6. **Emergency Exit**: Practice quick unstaking

**⚠️ Remember:**
• ❌ Testnet tokens have NO value
• 🔄 Networks may reset unexpectedly  
• 📋 Document everything for mainnet
• 🎯 Focus on learning, not profits

**Ready to analyze your testnet wallet?**
Use: \`analyze my testnet wallet [your-address]\``;


    const testnetOpportunities = [
      {
      }
    ];

    const result: ActionResult = {
      text: response,
      success: true,
      data: { type: "testnet_guide" }
    };

    callback?.({
      text: response,
      content: {
        text: response,
        action: "TESTNET_STAKING_GUIDE",
        opportunities: testnetOpportunities, 
        isTestnet: true,
        guideType: "testnet_staking",
        providedAt: Date.now(),
        data: { 
          opportunities: testnetOpportunities,
          type: "testnet_guide",
          isTestnet: true
        }
      }
    });

    return result;
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "how do I test staking on testnet?" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "🧪 I'll guide you through testnet staking step by step...",
          action: "TESTNET_STAKING_GUIDE",
        },
      },
    ],
  ] as ActionExample[][],
};

// Helper function to extract opportunities from analysis
function extractStakingOpportunitiesFromAnalysis(analysis: any): StakingOpportunity[] {
  const opportunities: StakingOpportunity[] = [];
  
  if (analysis.testnetBalances) {
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


export const analyzeMainnetWalletAction: Action = {
  name: "ANALYZE_WALLET_AND_RECOMMEND",
  similes: [
    "analyze my wallet",
    "analyze my testnet wallet",
    "personalized recommendations", 
    "check my portfolio",
    "wallet analysis",
    "staking recommendations",
    "analyze portfolio",
    "wallet insights",
    "defi analysis",
    "testnet analysis"
  ],
  description: "Analyze user's wallet and provide comprehensive personalized staking recommendations based on holdings, behavior patterns, and risk profile. Supports both mainnet and testnet analysis.",
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';
    const hasWalletAddress = Validator.extractWalletAddress(text);
    
    return (
      (text.includes("analyze") && (text.includes("wallet") || text.includes("portfolio"))) ||
      text.includes("personalized") ||
      text.includes("recommend") ||
      text.includes("staking") ||
      text.includes("testnet") ||
      !!hasWalletAddress
    );
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
      const isTestnetRequest = Validator.isTestnetRequest(message.content.text || '');

      if (!walletAddress) {
        const errorResponse = {
          text: isTestnetRequest 
            ? "🧪 Please provide a valid wallet address for testnet analysis. Example: analyze my testnet wallet 0x742d35Cc6654C2cFc2B28B44E8D9c8C0E4cB9fcE"
            : "❌ Please provide a valid wallet address to analyze. Example: 0x742d35Cc6654C2cFc2B28B44E8D9c8C0E4cB9fcE",
          content: {
            text: "Please provide a valid wallet address to analyze.",
            action: "ANALYZE_WALLET_AND_RECOMMEND"
          }
        };

        if (callback) {
          callback(errorResponse);
        }
        return;
      }

      elizaLogger.info(`🎯 Starting ${isTestnetRequest ? 'testnet' : 'comprehensive'} analysis for ${walletAddress}`);
      
      const walletAnalyzer = new WalletAnalyzer();
      const analysis = await walletAnalyzer.analyzeWallet(runtime, walletAddress, isTestnetRequest);

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
        riskWarnings,
        isTestnetRequest
      );

      const result: ActionResult = {
        text: response,
        success: true,
        data: {
          walletAnalysis: analysis,
          recommendations: enhancedRecommendations,
          actionableInsights,
          riskWarnings,
          isTestnet: isTestnetRequest
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
        content: { text: "Analyze my testnet wallet 0x8765...4321" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "🧪 Analyzing your testnet wallet to find testing opportunities and validate staking strategies...",
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


// Enhanced action that properly handles testnet requests
export const analyzeWalletAction: Action = {
  name: "ANALYZE_WALLET",
  similes: [
    "analyze wallet",
    "analyze my wallet", 
    "wallet analysis",
    "check wallet",
    "wallet breakdown",
    "analyze testnet wallet",
    "testnet analysis",
    "check my testnet wallet",
    "analyze my testnet",
    "testnet wallet analysis"
  ],
  description: "Analyze a wallet for comprehensive staking recommendations with testnet support",
  
  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content.text?.toLowerCase() || '';
    
    // Check for analyze + wallet keywords
    const hasAnalyzeKeyword = text.includes("analyze") && (text.includes("wallet") || text.includes("testnet"));
    
    // Check for wallet address
    const hasAddress = /0x[a-fA-F0-9]{40}/.test(text);
    
    // Check for testnet-specific keywords
    const hasTestnetKeyword = text.includes("testnet") || text.includes("sepolia") || text.includes("goerli");
    
    return hasAnalyzeKeyword || hasAddress || hasTestnetKeyword;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ): Promise<void | ActionResult | undefined> => {
    try {
      // Extract wallet address from message
      const walletAddress = Validator.extractWalletAddress(message.content.text || '');
      
      if (!walletAddress || !Validator.isValidAddress(walletAddress)) {
        const errorMsg = "❌ Please provide a valid wallet address to analyze.\n\nExample: `analyze my wallet 0x1234...` or `analyze my testnet wallet 0x1234...`";
        
        callback?.({ 
          text: errorMsg, 
          content: { 
            text: errorMsg, 
            action: "ANALYZE_WALLET" 
          }
        });
        
        return { text: errorMsg, success: false };
      }

      // Detect if this is a testnet request
      const isTestnetRequest = Validator.isTestnetRequest(message.content.text || '');
      
      elizaLogger.info(`🔍 Analyzing wallet: ${walletAddress} (testnet: ${isTestnetRequest})`);

      // Send initial response
      const initialResponse = isTestnetRequest 
        ? "🧪 Analyzing your testnet wallet for testing staking strategies..."
        : "🔍 Analyzing your wallet for staking opportunities...";

      callback?.({
        text: initialResponse,
        content: {
          text: initialResponse,
          action: "ANALYZE_WALLET"
        }
      });

      // Perform the analysis
      const walletAnalyzer = new WalletAnalyzer();
      
      let analysis;
      if (isTestnetRequest) {
        // Use dedicated testnet analysis method
        analysis = await walletAnalyzer.analyzeWallet(runtime, walletAddress, true);
      } else {
        // Regular analysis
        analysis = await walletAnalyzer.analyzeWallet(runtime, walletAddress, false);
      }

      // Format the comprehensive response
      const response = walletAnalyzer.formatAnalysisResponse(analysis, state?.agentName || "Agent");

      const result: ActionResult = {
        text: response,
        success: true,
        data: { 
          analysis,
          isTestnet: isTestnetRequest,
          address: walletAddress,
          recommendations: analysis.stakingRecommendations,
          totalRecommendations: analysis.stakingRecommendations.length,
          hasBalance: parseFloat(analysis.totalBalance) > 0,
          chainCount: Object.keys(analysis.nativeBalances).length
        }
      };

      // Send final comprehensive response
      callback?.({
        text: response,
        content: {
          text: response,
          action: "ANALYZE_WALLET"
        }
      });

      elizaLogger.info(`✅ Wallet analysis completed for ${walletAddress}. Found ${analysis.stakingRecommendations.length} recommendations.`);

      return result;
      
    } catch (error) {
      elizaLogger.error("Error in wallet analysis:", error);
      
      const errorMessage = `❌ Failed to analyze wallet: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or check that the wallet address is correct.`;
      const errorResponse = {
        text: errorMessage,
        content: {
          text: errorMessage,
          action: "ANALYZE_WALLET"
        }
      };
      
      callback?.(errorResponse);
      return { text: errorMessage, success: false };
    }
  },

  examples: [
    [
      {
        user: "{{user1}}",
        content: { text: "analyze my testnet wallet 0x60eF148485C2a5119fa52CA13c52E9fd98F28e87" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "🧪 Analyzing your testnet wallet for comprehensive staking opportunities and testing strategies...",
          action: "ANALYZE_WALLET",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "check my wallet 0x1234567890123456789012345678901234567890 for staking options" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "🔍 Analyzing your wallet for staking opportunities and portfolio optimization...",
          action: "ANALYZE_WALLET",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "analyze wallet [0xabcd1234567890123456789012345678901234abcd]" },
      },
      {
        name: "{{agentName}}",
        content: {
          text: "🔍 Analyzing wallet for comprehensive staking recommendations...",
          action: "ANALYZE_WALLET",
        },
      },
    ],
  ] as ActionExample[][],
};
  


// Export all actions
export const walletAnalysisActions: Action[] = [
  analyzeWalletAction,
  testnetStakingAction,
  analyzeMainnetWalletAction,
  quickStakingCheckAction,
  riskAssessmentAction,
  optimizePortfolioAction,
  testnetAnalysisAction,
];