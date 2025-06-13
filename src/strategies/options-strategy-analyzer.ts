// Options Strategy Analyzer - Enhanced Technical Analysis System
// Implements dynamic strategy switching with volatility and signal strength optimization

import { MarketData } from '../types';
import { MarketDataService } from '../services/market-data-service';
import { OptionsService } from '../services/options-service';
import { VIXService } from '../services/vix-service';
import { RiskManager } from '../services/risk-manager';
import { VolatilityAnalysis } from '../utils/volatility-analysis';
import { format, toZonedTime } from 'date-fns-tz';
import { TechnicalAnalysis } from '../utils/technical-analysis';
import { Logger } from '../core/logger';

export interface StrategyParameters {
  strategy: string;
  buyStrike?: number;
  sellStrike?: number;
  buyOptionType?: 'PUT' | 'CALL';
  sellOptionType?: 'PUT' | 'CALL';
  targetCredit: number;
  maxLoss: number;
  maxProfit: number;
  maxReturnOnRisk: number;
  daysToExpiration: number;
  expiryDate: Date;
  breakevenPrice: number;
  probabilityOfProfit: number;
}

export interface StrategyRecommendation {
  strategy: string;
  positionSize: number;
  reasoning: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedWinRate: number;
  signalStrength: number;
  maxRisk: number;
  parameters: StrategyParameters;
}

interface AccountInfo {
  balance: number;
  maxRiskPerTrade: number;
  maxOpenPositions: number;
  currentDrawdown: number;
}

export class OptionsStrategyAnalyzer {
  private static readonly VIX_THRESHOLDS = {
    LOW: 15,
    MEDIUM: 20,
    HIGH: 25
  };

  private static readonly RSI_THRESHOLDS = {
    OVERSOLD: 30,
    OVERBOUGHT: 70
  };

  private accountInfo: AccountInfo;
  private readonly MIN_DAYS_TO_EXPIRATION = 20;
  private readonly MAX_DAYS_TO_EXPIRATION = 30;
  private marketDataService: MarketDataService;
  private optionsService: OptionsService;
  private vixService: VIXService;
  private logger: Logger;

  constructor(accountInfo: AccountInfo) {
    this.accountInfo = accountInfo;
    this.marketDataService = new MarketDataService();
    this.optionsService = new OptionsService();
    this.vixService = new VIXService();
    this.logger = Logger.getInstance();
  }

  /**
   * Get current recommendation based on market conditions
   */
  async getCurrentRecommendation(): Promise<StrategyRecommendation> {
    try {
      const data = await this.marketDataService.fetchCurrentMarketData();
      const marketBias = TechnicalAnalysis.determineMarketBias(data);
      const ivEnvironment = VolatilityAnalysis.determineIVEnvironment(data.vix);
      const strategy = this.determineStrategy(data, marketBias, ivEnvironment);
      const parameters = await this.getStrategyParameters(data, strategy);
      const riskMetrics = RiskManager.calculateRiskMetrics(data, this.accountInfo.balance);
      const positionSize = Math.min(riskMetrics.maxPositionSize, this.accountInfo.balance * 0.08); // 8% of account balance
      const signalStrength = TechnicalAnalysis.calculateSignalStrength(data);
      const expectedWinRate = TechnicalAnalysis.calculateExpectedWinRate(data, strategy, parameters.daysToExpiration);
      const riskLevel = this.determineRiskLevel(data);

      return {
        strategy,
        positionSize,
        expectedWinRate,
        riskLevel,
        signalStrength,
        maxRisk: riskMetrics.maxRisk,
        reasoning: this.generateReasoning(data, strategy, marketBias, ivEnvironment),
        parameters
      };
    } catch (error) {
      this.logger.error('Error getting current recommendation:', error as Error);
      throw error;
    }
  }

  /**
   * Determine optimal strategy based on market conditions
   */
  private determineStrategy(
    data: MarketData,
    marketBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    ivEnvironment: 'LOW' | 'MEDIUM' | 'HIGH'
  ): string {
    const volatilityRegime = VolatilityAnalysis.getVolatilityRegime(data.vix, data.ivPercentile);
    
    // Log strategy determination factors
    console.log('Strategy Determination:', {
      marketBias,
      ivEnvironment,
      volatilityRegime,
      vix: data.vix,
      ivPercentile: data.ivPercentile,
      volatilityAdjustment: VolatilityAnalysis.calculateVolatilityAdjustment(data.vix, data.ivPercentile)
    });

    // High IV Environment
    if (ivEnvironment === 'HIGH') {
      if (marketBias === 'BULLISH') return 'BULL_PUT_SPREAD';
      if (marketBias === 'BEARISH') return 'BEAR_CALL_SPREAD';
      return 'IRON_CONDOR';
    }

    // Low IV Environment
    if (ivEnvironment === 'LOW') {
      if (marketBias === 'BULLISH') return 'BULL_CALL_SPREAD';
      if (marketBias === 'BEARISH') return 'BEAR_PUT_SPREAD';
      return 'CALENDAR_SPREAD';
    }

    // Medium IV Environment
    if (marketBias === 'BULLISH') return 'BULL_PUT_SPREAD';
    if (marketBias === 'BEARISH') return 'BEAR_CALL_SPREAD';
    return 'IRON_CONDOR';
  }

  /**
   * Determine risk level based on market conditions
   */
  private determineRiskLevel(data: MarketData): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (data.vix > VolatilityAnalysis.VIX_THRESHOLDS.HIGH) return 'HIGH';
    if (data.vix < VolatilityAnalysis.VIX_THRESHOLDS.LOW) return 'LOW';
    return 'MEDIUM';
  }

  /**
   * Generate reasoning for the strategy recommendation
   */
  private generateReasoning(
    data: MarketData,
    strategy: string,
    marketBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    ivEnvironment: 'LOW' | 'MEDIUM' | 'HIGH'
  ): string {
    const reasons = [] as string[];

    // Market bias reasoning
    reasons.push(`Market bias is ${marketBias.toLowerCase()} based on technical indicators`);

    // Volatility reasoning
    reasons.push(`Volatility is ${ivEnvironment.toLowerCase()} (VIX: ${data.vix.toFixed(2)})`);

    // Technical indicator reasoning
    if (data.price > data.sma50 && data.price > data.sma200) {
      reasons.push('Price is above both 50 and 200-day moving averages');
    } else if (data.price < data.sma50 && data.price < data.sma200) {
      reasons.push('Price is below both 50 and 200-day moving averages');
    }

    // Detailed MACD analysis
    if (data.macd > 0) {
      reasons.push(`MACD is positive (${data.macd.toFixed(2)}), indicating upward momentum`);
    } else if (data.macd < 0) {
      reasons.push(`MACD is negative (${data.macd.toFixed(2)}), indicating downward momentum`);
    }

    // Detailed RSI analysis
    if (data.rsi >= 70) {
      reasons.push(`RSI is overbought at ${data.rsi.toFixed(2)}, suggesting potential reversal`);
    } else if (data.rsi <= 30) {
      reasons.push(`RSI is oversold at ${data.rsi.toFixed(2)}, suggesting potential bounce`);
    } else if (data.rsi > 60) {
      reasons.push(`RSI is elevated at ${data.rsi.toFixed(2)}, approaching overbought territory`);
    } else if (data.rsi < 40) {
      reasons.push(`RSI is depressed at ${data.rsi.toFixed(2)}, approaching oversold territory`);
    } else {
      reasons.push(`RSI is neutral at ${data.rsi.toFixed(2)}`);
    }

    return reasons.join('. ');
  }

  /**
   * Get strategy parameters based on the selected strategy
   */
  private async getStrategyParameters(marketData: MarketData, strategy: string): Promise<StrategyParameters> {
    const currentPrice = marketData.price;
    const ivPercentile = marketData.ivPercentile;
    const vix = marketData.vix;

    try {
      // Get options data for 25 DTE
      const optionsData = await this.optionsService.getOptionsDataForDaysToExpiry(25);
      if (!optionsData?.strikes?.put || !optionsData?.strikes?.call) {
        throw new Error('No valid options data available');
      }

      // Get the expiry date from the options data
      const expiryDate = new Date(optionsData.options[0].expirationDate * 1000);
      
      // Calculate actual days to expiration
      const today = new Date();
      const daysToExpiration = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      // Get available strikes
      const putStrikes = Object.keys(optionsData.strikes.put).map(Number).sort((a, b) => a - b);
      const callStrikes = Object.keys(optionsData.strikes.call).map(Number).sort((a, b) => a - b);

      if (putStrikes.length === 0 || callStrikes.length === 0) {
        throw new Error('No strikes available in options data');
      }

      let buyStrike: number;
      let sellStrike: number;
      let targetCredit: number;
      let maxLoss: number;
      let probabilityOfProfit: number;

      switch (strategy) {
        case 'BULL_PUT_SPREAD': {
          // For bull put spread, we want to sell a put at a higher strike and buy a put at a lower strike
          const targetSellStrike = Math.round(currentPrice * 0.98); // 2% OTM
          const targetBuyStrike = Math.round(currentPrice * 0.96); // 4% OTM
          
          // Find closest available strikes
          sellStrike = putStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetSellStrike) < Math.abs(prev - targetSellStrike) ? curr : prev
          );
          buyStrike = putStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetBuyStrike) < Math.abs(prev - targetBuyStrike) ? curr : prev
          );

          // Get actual option prices
          const sellPut = optionsData.strikes.put[sellStrike];
          const buyPut = optionsData.strikes.put[buyStrike];

          if (!sellPut || !buyPut) {
            throw new Error('Could not find option prices for selected strikes');
          }

          // Calculate actual credit and max loss
          targetCredit = sellPut.lastPrice - buyPut.lastPrice;
          maxLoss = (sellStrike - buyStrike) - targetCredit;

          // Calculate breakeven price
          const breakevenPrice = sellStrike - targetCredit;

          // Calculate probability of profit
          probabilityOfProfit = TechnicalAnalysis.calculateProbabilityOfProfit(
            currentPrice,
            sellStrike,
            buyStrike,
            sellPut.impliedVolatility,
            buyPut.impliedVolatility,
            daysToExpiration,
            marketData
          );

          // Calculate max profit and return on risk
          const maxProfit = targetCredit;
          const maxReturnOnRisk = (maxProfit / maxLoss) * 100;

          const parameters: StrategyParameters = {
            strategy,
            buyStrike,
            sellStrike,
            buyOptionType: 'PUT' as const,
            sellOptionType: 'PUT' as const,
            targetCredit,
            maxLoss,
            maxProfit,
            maxReturnOnRisk,
            daysToExpiration,
            expiryDate,
            breakevenPrice,
            probabilityOfProfit
          };

          // Log the parameters for debugging
          console.log('Bull Put Spread Parameters:', parameters);

          return parameters;
        }

        case 'BEAR_CALL_SPREAD': {
          // Find strikes closest to 2% and 4% OTM
          const targetCallSellStrike = Math.round(currentPrice * 1.02);
          const targetCallBuyStrike = Math.round(currentPrice * 1.04);
          
          // Find closest available strikes
          sellStrike = callStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetCallSellStrike) < Math.abs(prev - targetCallSellStrike) ? curr : prev
          );
          buyStrike = callStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetCallBuyStrike) < Math.abs(prev - targetCallBuyStrike) ? curr : prev
          );

          // Get actual option prices
          const sellCall = optionsData.strikes.call[sellStrike];
          const buyCall = optionsData.strikes.call[buyStrike];

          if (!sellCall || !buyCall) {
            throw new Error('Could not find option prices for selected strikes');
          }

          // Calculate actual credit and max loss
          targetCredit = sellCall.lastPrice - buyCall.lastPrice;
          maxLoss = (buyStrike - sellStrike) - targetCredit;

          // Calculate breakeven price
          const breakevenPrice = sellStrike + targetCredit;

          // Calculate probability of profit
          probabilityOfProfit = TechnicalAnalysis.calculateProbabilityOfProfit(
            currentPrice,
            sellStrike,
            buyStrike,
            sellCall.impliedVolatility,
            buyCall.impliedVolatility,
            daysToExpiration,
            marketData
          );

          // Calculate max profit and return on risk
          const maxProfit = targetCredit;
          const maxReturnOnRisk = (maxProfit / maxLoss) * 100;

          const parameters: StrategyParameters = {
            strategy,
            buyStrike,
            sellStrike,
            buyOptionType: 'CALL' as const,
            sellOptionType: 'CALL' as const,
            targetCredit,
            maxLoss,
            maxProfit,
            maxReturnOnRisk,
            daysToExpiration,
            expiryDate,
            breakevenPrice,
            probabilityOfProfit
          };

          // Log the parameters for debugging
          console.log('Bear Call Spread Parameters:', parameters);

          return parameters;
        }

        case 'IRON_CONDOR': {
          // Find strikes for both spreads
          const putSellStrike = putStrikes.reduce((prev, curr) => 
            Math.abs(curr - currentPrice * 0.98) < Math.abs(prev - currentPrice * 0.98) ? curr : prev
          );
          const putBuyStrike = putStrikes.reduce((prev, curr) => 
            Math.abs(curr - currentPrice * 0.96) < Math.abs(prev - currentPrice * 0.96) ? curr : prev
          );
          const callSellStrike = callStrikes.reduce((prev, curr) => 
            Math.abs(curr - currentPrice * 1.02) < Math.abs(prev - currentPrice * 1.02) ? curr : prev
          );
          const callBuyStrike = callStrikes.reduce((prev, curr) => 
            Math.abs(curr - currentPrice * 1.04) < Math.abs(prev - currentPrice * 1.04) ? curr : prev
          );

          // Get actual option prices
          const putSell = optionsData.strikes.put[putSellStrike];
          const putBuy = optionsData.strikes.put[putBuyStrike];
          const callSell = optionsData.strikes.call[callSellStrike];
          const callBuy = optionsData.strikes.call[callBuyStrike];

          if (!putSell || !putBuy || !callSell || !callBuy) {
            throw new Error('Could not find option prices for selected strikes');
          }

          // Calculate actual credit and max loss
          const putCredit = putSell.lastPrice - putBuy.lastPrice;
          const callCredit = callSell.lastPrice - callBuy.lastPrice;
          targetCredit = putCredit + callCredit;
          maxLoss = Math.max(putSellStrike - putBuyStrike, callBuyStrike - callSellStrike) - targetCredit;

          // Calculate breakeven price
          const breakevenPrice = putSellStrike - putCredit;

          probabilityOfProfit = TechnicalAnalysis.calculateProbabilityOfProfit(
            currentPrice,
            putSellStrike,
            putBuyStrike,
            putSell.impliedVolatility,
            putBuy.impliedVolatility,
            daysToExpiration,
            marketData
          );

          // Calculate max profit and return on risk
          const maxProfit = targetCredit;
          const maxReturnOnRisk = (maxProfit / maxLoss) * 100;

          const parameters: StrategyParameters = {
            strategy,
            buyStrike: putBuyStrike,
            sellStrike: putSellStrike,
            buyOptionType: 'PUT' as const,
            sellOptionType: 'PUT' as const,
            targetCredit,
            maxLoss,
            maxProfit,
            maxReturnOnRisk,
            daysToExpiration,
            expiryDate,
            breakevenPrice,
            probabilityOfProfit
          };

          // Log the parameters for debugging
          console.log('Iron Condor Parameters:', parameters);

          return parameters;
        }

        default:
          throw new Error(`Unsupported strategy: ${strategy}`);
      }
    } catch (error) {
      console.error('Error getting strategy parameters:', error);
      throw error;
    }
  }

  /**
   * Update account information
   */
  public updateAccount(newAccountInfo: Partial<AccountInfo>): void {
    this.accountInfo = { ...this.accountInfo, ...newAccountInfo };
  }

  /**
   * Get formatted recommendation string
   */
  private getFormattedRecommendation(recommendation: StrategyRecommendation): string {
    const {
      strategy,
      parameters,
      reasoning,
      riskLevel,
      signalStrength,
      positionSize,
      expectedWinRate,
      maxRisk
    } = recommendation;

    // Log the values for debugging
    console.log('Strategy Parameters in getFormattedRecommendation:', {
      targetCredit: parameters.targetCredit,
      maxProfit: parameters.maxProfit,
      maxLoss: parameters.maxLoss,
      maxReturnOnRisk: parameters.maxReturnOnRisk
    });

    const output = `
Strategy: ${strategy}
Position Size: $${positionSize.toFixed(2)}
Expected Win Rate: ${expectedWinRate}%
Risk Level: ${riskLevel}
Signal Strength: ${signalStrength.toFixed(1)}/5
Max Risk: $${maxRisk.toFixed(2)}

Strategy Parameters:
- Target Credit: $${parameters.targetCredit.toFixed(2)}
- Max Profit: $${parameters.maxProfit.toFixed(2)}
- Max Loss: $${parameters.maxLoss.toFixed(2)}
- Risk/Profit Ratio: ${(parameters.maxProfit / parameters.maxLoss).toFixed(2)}
- Max Return on Risk: ${parameters.maxReturnOnRisk.toFixed(1)}%

Strike Prices:
- Sell ${parameters.sellOptionType} at $${parameters.sellStrike}
- Buy ${parameters.buyOptionType} at $${parameters.buyStrike}
- Breakeven Price: $${parameters.breakevenPrice.toFixed(2)}

Expiration:
- Days to Expiration: ${parameters.daysToExpiration}
- Expiry Date: ${parameters.expiryDate.toLocaleDateString()}

Reasoning:
${reasoning}
`;

    // Log the final output for debugging
    console.log('Final Output:', output);

    return output;
  }

  private formatExpiryDate(expiryDate: Date): string {
    const expiryTimestamp = expiryDate.getTime() / 1000; // Convert to seconds
    const expiryTimestampMs = expiryTimestamp * 1000;
    const estDate = toZonedTime(expiryTimestampMs, 'America/New_York');
    const expiryDateString = format(estDate, 'yyyy-MM-dd', { timeZone: 'America/New_York' });
    return expiryDateString;
  }
}

// Example usage and testing
/*
const accountInfo: AccountInfo = {
  balance: 40000,
  maxRiskPerTrade: 0.15, // 15% max risk per trade
  maxOpenPositions: 3,
  currentDrawdown: 0 // No current drawdown
};
 
const analyzer = new OptionsStrategyAnalyzer(accountInfo);
 
// Current market data (June 2025 example)
const marketData: MarketData = {
  price: 601.36,
  sma50: 556.4,
  sma200: 581.1,
  macd: 9.51,
  rsi: 61.31,
  vix: 24.70,
  ivPercentile: 45, // Would need to calculate this from historical data
  adx: 22.5,
  date: new Date()
};
 
const recommendation = analyzer.getCurrentRecommendation(marketData);
console.log(analyzer.getFormattedRecommendation(recommendation));
*/