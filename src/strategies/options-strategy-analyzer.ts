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
  position: 'LONG' | 'SHORT' | 'NEUTRAL';
  // For iron condor
  putSellStrike?: number;
  putBuyStrike?: number;
  callSellStrike?: number;
  callBuyStrike?: number;
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

  constructor(
    accountInfo: AccountInfo,
    marketDataService?: MarketDataService,
    optionsService?: OptionsService,
    vixService?: VIXService
  ) {
    this.accountInfo = accountInfo;
    this.marketDataService = marketDataService || new MarketDataService();
    this.optionsService = optionsService || new OptionsService();
    this.vixService = vixService || new VIXService();
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
      const strategy = this.determineStrategy(data);
      const parameters = await this.getStrategyParameters(data, strategy);
      const riskMetrics = RiskManager.calculateRiskMetrics(data, this.accountInfo.balance);
      
      // Calculate position size with drawdown consideration
      let maxPositionSize;
      if (data.ivPercentile >= 70) {
        // High IV environment - increase position size
        maxPositionSize = Math.max(
          this.accountInfo.balance * 0.1001, // Minimum just above 10% of account balance
          Math.min(
            riskMetrics.maxPositionSize,
            this.accountInfo.balance * 0.15, // Up to 15% of account balance
            this.accountInfo.balance * (0.08 - this.accountInfo.currentDrawdown) // Respect max drawdown
          )
        );
      } else if (data.ivPercentile <= 30) {
        // Low IV environment - reduce position size
        maxPositionSize = Math.min(
          riskMetrics.maxPositionSize,
          this.accountInfo.balance * 0.04, // 4% of account balance
          this.accountInfo.balance * (0.02 - this.accountInfo.currentDrawdown) // Respect max drawdown
        );
      } else {
        // Medium IV environment
        maxPositionSize = Math.min(
          riskMetrics.maxPositionSize,
          this.accountInfo.balance * 0.08, // 8% of account balance
          this.accountInfo.balance * (0.04 - this.accountInfo.currentDrawdown) // Respect max drawdown
        );
      }
      
      const positionSize = Math.max(0, maxPositionSize);
      const signalStrength = TechnicalAnalysis.calculateSignalStrength(data);
      const expectedWinRate = TechnicalAnalysis.calculateExpectedWinRate(data, strategy, parameters.daysToExpiration);
      
      // Determine risk level based on IV percentile and correlation
      let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      if (data.ivPercentile >= 70 || (data.adx >= 40 && Math.abs(data.plusDI - data.minusDI) >= 30)) {
        riskLevel = 'HIGH';
      } else if (data.ivPercentile <= 30) {
        riskLevel = 'LOW';
      } else {
        riskLevel = 'MEDIUM';
      }

      return {
        strategy,
        positionSize,
        expectedWinRate,
        riskLevel,
        signalStrength,
        maxRisk: Math.min(riskMetrics.maxRisk, positionSize),
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
  private determineStrategy(data: MarketData): string {
    const marketBias = TechnicalAnalysis.determineMarketBias(data);
    const signalStrength = TechnicalAnalysis.calculateSignalStrength(data);
    const isHighIV = data.ivPercentile >= 70;
    const isLowIV = data.ivPercentile <= 30;

    // Log strategy determination factors
    this.logger.debug('Strategy Determination Factors:', {
      marketBias,
      signalStrength,
      vix: data.vix,
      ivPercentile: data.ivPercentile,
      rsi: data.rsi,
      sma50: data.sma50,
      sma200: data.sma200,
      macd: data.macd
    });

    // For high IV environments, we want to sell options
    if (isHighIV) {
      // Overbought/oversold takes precedence in high IV
      if (data.rsi >= 70) return 'BEAR_CALL_SPREAD';
      if (data.rsi <= 30) return 'BULL_PUT_SPREAD';
      // Then check trend/momentum
      if (data.sma50 > data.sma200 && data.macd > 0) return 'BULL_PUT_SPREAD';
      if (data.sma50 < data.sma200 && data.macd < 0) return 'BEAR_CALL_SPREAD';
      // Neutral high IV
      return 'IRON_CONDOR';
    }

    // For low IV environments, we want to buy options
    if (isLowIV) {
      // Bullish conditions in low IV
      if (data.rsi <= 30 || (data.sma50 > data.sma200 && data.macd > 0)) {
        return 'BULL_CALL_SPREAD';
      }
      // Bearish conditions in low IV
      if (data.rsi >= 70 || (data.sma50 < data.sma200 && data.macd < 0)) {
        return 'BEAR_PUT_SPREAD';
      }
      // Neutral low IV
      return 'NO_TRADE';
    }

    // Medium IV environment - use calendar spreads
    return 'CALENDAR_SPREAD';
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
    if (data.ivPercentile >= 70) {
      reasons.push(`Volatility is high IV (IV percentile: ${data.ivPercentile.toFixed(2)}, VIX: ${data.vix.toFixed(2)})`);
    } else if (data.ivPercentile <= 30) {
      reasons.push(`Volatility is low IV (IV percentile: ${data.ivPercentile.toFixed(2)}, VIX: ${data.vix.toFixed(2)})`);
    } else {
      reasons.push(`Volatility is medium (IV percentile: ${data.ivPercentile.toFixed(2)}, VIX: ${data.vix.toFixed(2)})`);
    }

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
      let buyOptionType: 'PUT' | 'CALL';
      let sellOptionType: 'PUT' | 'CALL';

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
          
          buyOptionType = 'PUT';
          sellOptionType = 'PUT';
          targetCredit = Math.abs(sellStrike - buyStrike) * 0.4; // Target 40% of max loss
          maxLoss = Math.abs(sellStrike - buyStrike) - targetCredit;
          probabilityOfProfit = TechnicalAnalysis.calculateProbabilityOfProfit(
            currentPrice,
            sellStrike,
            buyStrike,
            marketData.ivPercentile,
            marketData.ivPercentile,
            daysToExpiration
          );
          break;
        }

        case 'BEAR_CALL_SPREAD': {
          // For bear call spread, we want to sell a call at a lower strike and buy a call at a higher strike
          const targetSellStrike = Math.round(currentPrice * 1.02); // 2% OTM
          const targetBuyStrike = Math.round(currentPrice * 1.04); // 4% OTM
          
          // Find closest available strikes
          sellStrike = callStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetSellStrike) < Math.abs(prev - targetSellStrike) ? curr : prev
          );
          buyStrike = callStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetBuyStrike) < Math.abs(prev - targetBuyStrike) ? curr : prev
          );
          
          buyOptionType = 'CALL';
          sellOptionType = 'CALL';
          targetCredit = Math.abs(sellStrike - buyStrike) * 0.4; // Target 40% of max loss
          maxLoss = Math.abs(sellStrike - buyStrike) - targetCredit;
          probabilityOfProfit = TechnicalAnalysis.calculateProbabilityOfProfit(
            currentPrice,
            sellStrike,
            buyStrike,
            marketData.ivPercentile,
            marketData.ivPercentile,
            daysToExpiration
          );
          break;
        }

        case 'BULL_CALL_SPREAD': {
          // For bull call spread, we want to buy a call at a lower strike and sell a call at a higher strike
          const targetBuyStrike = Math.round(currentPrice * 1.02); // 2% OTM
          const targetSellStrike = Math.round(currentPrice * 1.04); // 4% OTM
          
          // Find closest available strikes
          buyStrike = callStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetBuyStrike) < Math.abs(prev - targetBuyStrike) ? curr : prev
          );
          sellStrike = callStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetSellStrike) < Math.abs(prev - targetSellStrike) ? curr : prev
          );
          
          buyOptionType = 'CALL';
          sellOptionType = 'CALL';
          targetCredit = Math.abs(sellStrike - buyStrike) * 0.4; // Target 40% of max loss
          maxLoss = Math.abs(sellStrike - buyStrike) - targetCredit;
          probabilityOfProfit = TechnicalAnalysis.calculateProbabilityOfProfit(
            currentPrice,
            sellStrike,
            buyStrike,
            marketData.ivPercentile,
            marketData.ivPercentile,
            daysToExpiration
          );
          break;
        }

        case 'BEAR_PUT_SPREAD': {
          // For bear put spread, we want to buy a put at a higher strike and sell a put at a lower strike
          const targetBuyStrike = Math.round(currentPrice * 0.98); // 2% OTM
          const targetSellStrike = Math.round(currentPrice * 0.96); // 4% OTM
          
          // Find closest available strikes
          buyStrike = putStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetBuyStrike) < Math.abs(prev - targetBuyStrike) ? curr : prev
          );
          sellStrike = putStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetSellStrike) < Math.abs(prev - targetSellStrike) ? curr : prev
          );
          
          buyOptionType = 'PUT';
          sellOptionType = 'PUT';
          targetCredit = Math.abs(sellStrike - buyStrike) * 0.4; // Target 40% of max loss
          maxLoss = Math.abs(sellStrike - buyStrike) - targetCredit;
          probabilityOfProfit = TechnicalAnalysis.calculateProbabilityOfProfit(
            currentPrice,
            sellStrike,
            buyStrike,
            marketData.ivPercentile,
            marketData.ivPercentile,
            daysToExpiration
          );
          break;
        }

        case 'IRON_CONDOR': {
          // Calculate dynamic strike distances based on volatility and market conditions
          const volatilityMultiplier = marketData.ivPercentile / 50; // Normalize to 1.0 at 50th percentile
          const baseDistance = currentPrice * 0.02; // Base 2% distance
          
          // Adjust distances based on volatility
          const putSellDistance = baseDistance * volatilityMultiplier;
          const putBuyDistance = putSellDistance * 1.5; // Wider spread for puts
          const callSellDistance = baseDistance * volatilityMultiplier;
          const callBuyDistance = callSellDistance * 1.5; // Wider spread for calls
          
          // Calculate target strikes
          const putSellStrike = Math.round(currentPrice - putSellDistance);
          const putBuyStrike = Math.round(currentPrice - putBuyDistance);
          const callSellStrike = Math.round(currentPrice + callSellDistance);
          const callBuyStrike = Math.round(currentPrice + callBuyDistance);
          
          // Find closest available strikes for puts
          const putSell = putStrikes.reduce((prev, curr) => 
            Math.abs(curr - putSellStrike) < Math.abs(prev - putSellStrike) ? curr : prev
          );
          const putBuy = putStrikes.reduce((prev, curr) => 
            Math.abs(curr - putBuyStrike) < Math.abs(prev - putBuyStrike) ? curr : prev
          );

          // Find closest available strikes for calls
          const callSell = callStrikes.reduce((prev, curr) => 
            Math.abs(curr - callSellStrike) < Math.abs(prev - callSellStrike) ? curr : prev
          );
          const callBuy = callStrikes.reduce((prev, curr) => 
            Math.abs(curr - callBuyStrike) < Math.abs(prev - callBuyStrike) ? curr : prev
          );
          
          // Calculate credit based on actual option prices from the options data
          const putSellPrice = optionsData.strikes.put[putSell]?.bid || 0;
          const putBuyPrice = optionsData.strikes.put[putBuy]?.ask || 0;
          const callSellPrice = optionsData.strikes.call[callSell]?.bid || 0;
          const callBuyPrice = optionsData.strikes.call[callBuy]?.ask || 0;
          
          // Calculate total credit from both spreads (multiply by 100 for options contract)
          const putSpreadCredit = (putSellPrice - putBuyPrice) * 100;
          const callSpreadCredit = (callSellPrice - callBuyPrice) * 100;
          const targetCredit = putSpreadCredit + callSpreadCredit;
          
          // Calculate max loss for each spread
          const putSpreadWidth = Math.abs(putSell - putBuy) * 100; // Multiply by 100 for options contract
          const callSpreadWidth = Math.abs(callSell - callBuy) * 100; // Multiply by 100 for options contract
          
          // Calculate max loss (width of wider spread minus credit)
          const maxLoss = Math.max(putSpreadWidth, callSpreadWidth) - targetCredit;
          
          // Calculate probability of profit using both spreads
          const putProb = TechnicalAnalysis.calculateProbabilityOfProfit(
            currentPrice,
            putSell,
            putBuy,
            marketData.ivPercentile,
            marketData.ivPercentile,
            daysToExpiration
          );
          
          const callProb = TechnicalAnalysis.calculateProbabilityOfProfit(
            currentPrice,
            callSell,
            callBuy,
            marketData.ivPercentile,
            marketData.ivPercentile,
            daysToExpiration
          );
          
          // Use the higher probability as the overall probability of profit
          const probabilityOfProfit = Math.max(putProb, callProb);

          return {
            strategy,
            position: 'SHORT',
            putSellStrike: putSell,
            putBuyStrike: putBuy,
            callSellStrike: callSell,
            callBuyStrike: callBuy,
            targetCredit,
            maxLoss,
            maxProfit: targetCredit,
            maxReturnOnRisk: (targetCredit / maxLoss) * 100,
            daysToExpiration,
            expiryDate,
            breakevenPrice: currentPrice,
            probabilityOfProfit
          };
        }

        case 'CALENDAR_SPREAD': {
          // For calendar spread, we want to sell a near-term option and buy a longer-term option
          const targetStrike = Math.round(currentPrice);
          
          // Find closest available strike
          sellStrike = callStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetStrike) < Math.abs(prev - targetStrike) ? curr : prev
          );
          buyStrike = sellStrike; // Same strike for calendar spread
          
          buyOptionType = 'CALL';
          sellOptionType = 'CALL';
          targetCredit = Math.abs(sellStrike - buyStrike) * 0.4; // Target 40% of max loss
          maxLoss = Math.abs(sellStrike - buyStrike) - targetCredit;
          probabilityOfProfit = TechnicalAnalysis.calculateProbabilityOfProfit(
            currentPrice,
            sellStrike,
            buyStrike,
            marketData.ivPercentile,
            marketData.ivPercentile,
            daysToExpiration
          );
          break;
        }

        case 'NO_TRADE': {
          // Return a default parameter object for no trade
          return {
            strategy: 'NO_TRADE',
            position: 'NEUTRAL',
            targetCredit: 0,
            maxLoss: 0,
            maxProfit: 0,
            maxReturnOnRisk: 0,
            daysToExpiration: 0,
            expiryDate: new Date(),
            breakevenPrice: 0,
            probabilityOfProfit: 0
          };
        }

        default:
          throw new Error(`Unsupported strategy: ${strategy}`);
      }

      // Log strategy parameters
      console.log('Strategy Parameters:', {
        strategy,
        buyStrike,
        sellStrike,
        buyOptionType,
        sellOptionType,
        targetCredit,
        maxLoss,
        maxProfit: targetCredit,
        maxReturnOnRisk: (targetCredit / maxLoss) * 100,
        daysToExpiration,
        expiryDate,
        breakevenPrice: strategy.includes('BULL') ? currentPrice + targetCredit : currentPrice - targetCredit,
        probabilityOfProfit
      });

      return {
        strategy,
        position: strategy.includes('BULL') ? 'LONG' : 'SHORT',
        buyStrike,
        sellStrike,
        buyOptionType,
        sellOptionType,
        targetCredit,
        maxLoss,
        maxProfit: targetCredit,
        maxReturnOnRisk: (targetCredit / maxLoss) * 100,
        daysToExpiration,
        expiryDate,
        breakevenPrice: strategy.includes('BULL') ? currentPrice + targetCredit : currentPrice - targetCredit,
        probabilityOfProfit
      };
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