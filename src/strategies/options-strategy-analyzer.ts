// Options Strategy Analyzer - Enhanced Technical Analysis System
// Implements dynamic strategy switching with volatility and signal strength optimization

import { MarketData } from '../types';
import { MarketDataService } from '../services/market-data-service';
import { OptionsService } from '../services/options-service';
import { format, toZonedTime } from 'date-fns-tz';
import { TechnicalAnalysis } from '../utils/technical-analysis';

interface TechnicalSignal {
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number; // 0-5 scale
  description: string;
  weight: number; // Importance of this signal
}

export interface StrategyParameters {
  strategy: string;
  buyStrike?: number;
  sellStrike?: number;
  buyOptionType?: 'PUT' | 'CALL';
  sellOptionType?: 'PUT' | 'CALL';
  targetCredit: number;
  maxLoss: number;
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
  strategyParameters: StrategyParameters;
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

  constructor(accountInfo: AccountInfo) {
    this.accountInfo = accountInfo;
    this.marketDataService = new MarketDataService();
    this.optionsService = new OptionsService();
  }

  /**
   * Get current strategy recommendation
   */
  public async getCurrentRecommendation(marketData: MarketData): Promise<StrategyRecommendation> {
    try {
      // Determine market bias and IV environment
      const marketBias = this.determineMarketBias(marketData);
      const ivEnvironment = this.determineIVEnvironment(marketData);

      // Get signal strength
      const signalStrength = this.calculateSignalStrength(marketData);

      // Determine optimal strategy
      const strategy = this.determineStrategy(marketData, marketBias, ivEnvironment);

      // Get strategy parameters
      const strategyParams = await this.getStrategyParameters(marketData, strategy);

      // Calculate risk metrics
      const riskMetrics = this.calculateRiskMetrics(marketData, strategy);

      // Calculate expected win rate
      const expectedWinRate = this.calculateExpectedWinRate(marketData, strategy);

      // Calculate position size
      const positionSize = this.calculatePositionSize(marketData, strategyParams, riskMetrics);

      // Generate reasoning
      const reasoning = this.generateReasoning(marketData, marketBias, ivEnvironment);

      return {
        strategy,
        positionSize,
        riskLevel: this.determineRiskLevel(marketData),
        expectedWinRate: expectedWinRate,
        signalStrength,
        maxRisk: riskMetrics.maxRisk,
        reasoning,
        strategyParameters: strategyParams
      };
    } catch (error) {
      console.error('Error getting strategy recommendation:', error);
      throw error;
    }
  }

  /**
   * Calculate signal strength based on technical indicators
   */
  private calculateSignalStrength(data: MarketData): number {
    let strength = 0;

    // Moving Average Analysis (25%)
    if (data.price > data.sma50) strength += 1.25;
    if (data.price > data.sma200) strength += 1.25;

    // MACD Analysis (15%)
    if (data.macd > 0) strength += 0.75;

    // RSI Analysis (15%)
    if (data.rsi < OptionsStrategyAnalyzer.RSI_THRESHOLDS.OVERSOLD) strength += 0.75;
    if (data.rsi > OptionsStrategyAnalyzer.RSI_THRESHOLDS.OVERBOUGHT) strength -= 0.75;

    // VIX Analysis (15%)
    if (data.vix < OptionsStrategyAnalyzer.VIX_THRESHOLDS.LOW) strength += 0.75;
    if (data.vix > OptionsStrategyAnalyzer.VIX_THRESHOLDS.HIGH) strength -= 0.75;

    // ADX Analysis (30%)
    const adxInterpretation = TechnicalAnalysis.interpretADX(data.adx);
    switch (adxInterpretation.strength) {
      case 'VERY_STRONG':
        strength += 1.5;
        break;
      case 'STRONG':
        strength += 1.0;
        break;
      case 'MODERATE':
        strength += 0.5;
        break;
      case 'WEAK':
        strength -= 0.5;
        break;
      case 'VERY_WEAK':
        strength -= 1.0;
        break;
    }

    return Math.max(0, Math.min(5, strength)); // Normalize to 0-5
  }

  /**
   * Determine market bias based on technical indicators
   */
  private determineMarketBias(data: MarketData): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const signals = {
      bullish: 0,
      bearish: 0
    };

    // Price vs Moving Averages
    if (data.price > data.sma50) signals.bullish++;
    if (data.price > data.sma200) signals.bullish++;
    if (data.price < data.sma50) signals.bearish++;
    if (data.price < data.sma200) signals.bearish++;

    // MACD
    if (data.macd > 0) signals.bullish++;
    if (data.macd < 0) signals.bearish++;

    // RSI
    if (data.rsi < OptionsStrategyAnalyzer.RSI_THRESHOLDS.OVERSOLD) signals.bullish++;
    if (data.rsi > OptionsStrategyAnalyzer.RSI_THRESHOLDS.OVERBOUGHT) signals.bearish++;

    // ADX Directional Movement
    if (data.plusDI > data.minusDI) signals.bullish++;
    if (data.minusDI > data.plusDI) signals.bearish++;

    // Weight ADX trend strength
    const adxInterpretation = TechnicalAnalysis.interpretADX(data.adx);
    if (adxInterpretation.strength === 'STRONG' || adxInterpretation.strength === 'VERY_STRONG') {
      if (data.plusDI > data.minusDI) signals.bullish++;
      if (data.minusDI > data.plusDI) signals.bearish++;
    }

    if (signals.bullish > signals.bearish) return 'BULLISH';
    if (signals.bearish > signals.bullish) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Determine IV environment based on VIX
   */
  private determineIVEnvironment(data: MarketData): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (data.vix < OptionsStrategyAnalyzer.VIX_THRESHOLDS.LOW) return 'LOW';
    if (data.vix > OptionsStrategyAnalyzer.VIX_THRESHOLDS.HIGH) return 'HIGH';
    return 'MEDIUM';
  }

  /**
   * Determine optimal strategy based on market conditions
   */
  private determineStrategy(
    data: MarketData,
    marketBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    ivEnvironment: 'LOW' | 'MEDIUM' | 'HIGH'
  ): string {
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
   * Calculate position size based on signal strength and account info
   */
  private calculatePositionSize(data: MarketData, strategyParams: StrategyParameters, riskMetrics: { maxRisk: number }): number {
    const baseSize = this.accountInfo.balance * this.accountInfo.maxRiskPerTrade;
    const vixAdjustment = data.vix > OptionsStrategyAnalyzer.VIX_THRESHOLDS.HIGH ? 0.7 : 1;
    const drawdownAdjustment = this.accountInfo.currentDrawdown > 10 ? 0.5 : 1;
    const expectedWinRate = this.calculateExpectedWinRate(data, strategyParams.strategy);

    return baseSize * (expectedWinRate / 100) * vixAdjustment * drawdownAdjustment;
  }

  /**
   * Calculate risk metrics for the strategy
   */
  private calculateRiskMetrics(data: MarketData, strategy: string): { maxRisk: number } {
    const baseRisk = this.accountInfo.balance * this.accountInfo.maxRiskPerTrade;
    const vixAdjustment = data.vix > OptionsStrategyAnalyzer.VIX_THRESHOLDS.HIGH ? 0.7 : 1;

    return {
      maxRisk: baseRisk * vixAdjustment
    };
  }

  /**
   * Determine risk level based on market conditions
   */
  private determineRiskLevel(data: MarketData): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (data.vix > OptionsStrategyAnalyzer.VIX_THRESHOLDS.HIGH) return 'HIGH';
    if (data.vix < OptionsStrategyAnalyzer.VIX_THRESHOLDS.LOW) return 'LOW';
    return 'MEDIUM';
  }

  /**
   * Calculate expected win rate based on strategy and market conditions
   */
  private calculateExpectedWinRate(data: MarketData, strategy: string): number {
    const baseWinRate = 0.65; // Base win rate for all strategies
    const vixAdjustment = data.vix > OptionsStrategyAnalyzer.VIX_THRESHOLDS.HIGH ? 0.1 : 0;
    const rsiAdjustment = Math.abs(data.rsi - 50) / 50 * 0.1;

    return Math.min(0.85, baseWinRate + vixAdjustment + rsiAdjustment);
  }

  /**
   * Generate reasoning for the strategy recommendation
   */
  private generateReasoning(
    data: MarketData,
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

    if (data.macd > 0) {
      reasons.push('MACD is positive, indicating upward momentum');
    } else if (data.macd < 0) {
      reasons.push('MACD is negative, indicating downward momentum');
    }

    if (data.rsi < OptionsStrategyAnalyzer.RSI_THRESHOLDS.OVERSOLD) {
      reasons.push('RSI indicates oversold conditions');
    } else if (data.rsi > OptionsStrategyAnalyzer.RSI_THRESHOLDS.OVERBOUGHT) {
      reasons.push('RSI indicates overbought conditions');
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

    // Get options data for the target DTE range
    let daysToExpiration = marketData.optionsData?.daysToExpiration || 25; // Default to 25 if not available
    let expiryDate = marketData.optionsData?.expiryDate || new Date();

    // Enforce DTE requirements
    if (daysToExpiration < this.MIN_DAYS_TO_EXPIRATION || daysToExpiration > this.MAX_DAYS_TO_EXPIRATION) {
      daysToExpiration = this.MIN_DAYS_TO_EXPIRATION;
      expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + daysToExpiration);
    }

    try {
      const optionsData = await this.optionsService.getOptionsDataForDaysToExpiry(daysToExpiration);
      
      if (!optionsData?.strikes?.put || Object.keys(optionsData.strikes.put).length === 0) {
        throw new Error('No valid options data found');
      }

      // Get available strikes
      const availableStrikes = Object.keys(optionsData.strikes.put).map(Number);
      if (availableStrikes.length === 0) {
        throw new Error('No strikes available in options data');
      }

      // Calculate strikes based on strategy
      let buyStrike: number;
      let sellStrike: number;
      let targetCredit: number;
      let maxLoss: number;

      switch (strategy) {
        case 'BULL_PUT_SPREAD':
          // Find strikes closest to 2% and 4% OTM
          const targetSellStrike = Math.round(currentPrice * 0.98);
          const targetBuyStrike = Math.round(currentPrice * 0.96);
          
          // Find closest available strikes
          sellStrike = availableStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetSellStrike) < Math.abs(prev - targetSellStrike) ? curr : prev
          );
          buyStrike = availableStrikes.reduce((prev, curr) => 
            Math.abs(curr - targetBuyStrike) < Math.abs(prev - targetBuyStrike) ? curr : prev
          );

          // Get actual option prices from options data
          const sellPut = optionsData.strikes.put[sellStrike];
          const buyPut = optionsData.strikes.put[buyStrike];

          if (!sellPut || !buyPut) {
            throw new Error('Could not find option prices for selected strikes');
          }

          // Calculate actual credit and max loss
          targetCredit = sellPut.bid - buyPut.ask;
          maxLoss = sellStrike - buyStrike - targetCredit;

          // Calculate probability of profit using implied volatility
          const breakevenPrice = sellStrike - targetCredit;
          const distanceToBreakeven = Math.abs(currentPrice - breakevenPrice);
          const avgIV = (sellPut.impliedVolatility + buyPut.impliedVolatility) / 2;
          const standardDeviation = currentPrice * avgIV * Math.sqrt(daysToExpiration / 365);
          const probabilityOfProfit = 1 - (distanceToBreakeven / standardDeviation);

          return {
            strategy,
            buyStrike,
            sellStrike,
            buyOptionType: 'PUT',
            sellOptionType: 'PUT',
            targetCredit,
            maxLoss,
            daysToExpiration,
            expiryDate,
            breakevenPrice,
            probabilityOfProfit: Math.max(0, Math.min(1, probabilityOfProfit))
          };

        case 'BEAR_CALL_SPREAD':
          // For bear call spread, use strikes that are 1-2% OTM
          sellStrike = Math.round(currentPrice * 1.02); // 2% OTM
          buyStrike = Math.round(currentPrice * 1.04); // 4% OTM
          const callSpreadWidth = buyStrike - sellStrike;
          targetCredit = callSpreadWidth * 0.35; // Target 35% of max loss
          maxLoss = callSpreadWidth - targetCredit;

          // Calculate probability of profit based on breakeven price
          const callBreakevenPrice = sellStrike + targetCredit;
          const callDistanceToBreakeven = Math.abs(currentPrice - callBreakevenPrice);
          const callProbabilityOfProfit = 1 - (callDistanceToBreakeven / callSpreadWidth);

          return {
            strategy,
            buyStrike,
            sellStrike,
            buyOptionType: 'CALL',
            sellOptionType: 'CALL',
            targetCredit,
            maxLoss,
            daysToExpiration,
            expiryDate,
            breakevenPrice: callBreakevenPrice,
            probabilityOfProfit: callProbabilityOfProfit
          };

        case 'IRON_CONDOR':
          // For iron condor, use 0.16 delta for all legs
          const putSpread = Math.round(currentPrice * 0.02); // 2% width
          const callSpread = Math.round(currentPrice * 0.02); // 2% width
          sellStrike = Math.round(currentPrice * 0.98); // Put spread
          buyStrike = Math.round(currentPrice * 0.96); // Put spread
          targetCredit = (putSpread + callSpread) * 0.35; // Target 35% of max loss
          maxLoss = Math.max(putSpread, callSpread) - targetCredit;

          // Calculate probability of profit based on breakeven prices
          const putBreakevenPrice = sellStrike - targetCredit;
          const putDistanceToBreakeven = Math.abs(currentPrice - putBreakevenPrice);
          const putProbabilityOfProfit = 1 - (putDistanceToBreakeven / putSpread);

          return {
            strategy,
            buyStrike,
            sellStrike,
            buyOptionType: 'PUT',
            sellOptionType: 'PUT',
            targetCredit,
            maxLoss,
            daysToExpiration,
            expiryDate,
            breakevenPrice: putBreakevenPrice,
            probabilityOfProfit: putProbabilityOfProfit
          };

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
  public getFormattedRecommendation(recommendation: StrategyRecommendation): string {
    return `
Strategy: ${recommendation.strategy}
Position Size: $${recommendation.positionSize.toFixed(2)}
Expected Win Rate: ${(recommendation.expectedWinRate * 100).toFixed(1)}%
Risk Level: ${recommendation.riskLevel}
Signal Strength: ${recommendation.signalStrength.toFixed(1)}/5
Max Risk: $${recommendation.maxRisk.toFixed(2)}

Reasoning:
${recommendation.reasoning}

Strategy Parameters:
- Target Credit: $${recommendation.strategyParameters.targetCredit.toFixed(2)}
- Max Loss: $${recommendation.strategyParameters.maxLoss.toFixed(2)}
- Days to Expiration: ${recommendation.strategyParameters.daysToExpiration}
- Expiry Date: ${this.formatExpiryDate(recommendation.strategyParameters.expiryDate)}
- Breakeven Price: $${recommendation.strategyParameters.breakevenPrice.toFixed(2)}
- Probability of Profit: ${(recommendation.strategyParameters.probabilityOfProfit * 100).toFixed(1)}%
${recommendation.strategyParameters.buyStrike ? `- Buy ${recommendation.strategyParameters.buyOptionType} Strike: $${recommendation.strategyParameters.buyStrike}` : ''}
${recommendation.strategyParameters.sellStrike ? `- Sell ${recommendation.strategyParameters.sellOptionType} Strike: $${recommendation.strategyParameters.sellStrike}` : ''}
`;
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