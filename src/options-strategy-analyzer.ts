// Options Strategy Analyzer - Enhanced Technical Analysis System
// Implements dynamic strategy switching with volatility and signal strength optimization

import { MarketData } from './types';
import { SPYDataFetcher } from './spy-data-fetcher';

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
  targetCredit: number;
  maxLoss: number;
  daysToExpiration: number;
}

export interface StrategyRecommendation {
  strategy: string;
  positionSize: number;
  confidence: number;
  reasoning: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  expectedWinRate: number;
  signalStrength: number;
  maxRisk: number;
  strategyParameters: StrategyParameters;
}

interface AccountInfo {
  balance: number;
  maxRiskPerTrade: number; // Maximum percentage to risk per trade
  maxOpenPositions: number;
  currentDrawdown: number; // Current drawdown percentage
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

  private static readonly ADX_THRESHOLDS = {
    WEAK: 20,
    STRONG: 40
  };

  private accountInfo: AccountInfo;
  private readonly MIN_DAYS_TO_EXPIRATION = 20;
  private readonly MAX_DAYS_TO_EXPIRATION = 30;

  constructor(accountInfo: AccountInfo) {
    this.accountInfo = accountInfo;
  }

  /**
   * Analyze current market conditions and recommend a strategy
   */
  static async analyzeStrategy(): Promise<StrategyRecommendation> {
    try {
      // Fetch current market data
      const marketData = await SPYDataFetcher.fetchCurrentMarketData();
      
      // Calculate signal strength
      const signalStrength = this.calculateSignalStrength(marketData);
      
      // Determine market bias
      const marketBias = this.determineMarketBias(marketData);
      
      // Determine IV environment
      const ivEnvironment = this.determineIVEnvironment(marketData);
      
      // Get strategy parameters
      const strategy = this.determineStrategy(marketData, marketBias, ivEnvironment);
      const strategyParams = this.getStrategyParameters(strategy, marketData);
      
      // Calculate position size
      const positionSize = this.calculatePositionSize(signalStrength, marketData);
      
      // Calculate risk metrics
      const riskMetrics = this.calculateRiskMetrics(marketData, strategy);
      
      return {
        strategy,
        positionSize,
        confidence: signalStrength / 5, // Normalize to 0-1
        reasoning: this.generateReasoning(marketData, strategy, marketBias, ivEnvironment),
        riskLevel: this.determineRiskLevel(marketData),
        expectedWinRate: this.calculateExpectedWinRate(marketData, strategy),
        signalStrength,
        maxRisk: riskMetrics.maxRisk,
        strategyParameters: strategyParams
      };
    } catch (error) {
      console.error('Error analyzing strategy:', error);
      throw error;
    }
  }

  /**
   * Calculate signal strength based on technical indicators
   */
  private static calculateSignalStrength(data: MarketData): number {
    let strength = 0;
    
    // Moving Average Analysis (30%)
    if (data.price > data.sma50) strength += 1.5;
    if (data.price > data.sma200) strength += 1.5;
    
    // MACD Analysis (20%)
    if (data.macd > 0) strength += 1;
    
    // RSI Analysis (20%)
    if (data.rsi < this.RSI_THRESHOLDS.OVERSOLD) strength += 1;
    if (data.rsi > this.RSI_THRESHOLDS.OVERBOUGHT) strength -= 1;
    
    // VIX Analysis (15%)
    if (data.vix < this.VIX_THRESHOLDS.LOW) strength += 0.75;
    if (data.vix > this.VIX_THRESHOLDS.HIGH) strength -= 0.75;
    
    // ADX Analysis (15%)
    const adx = data.adx ?? 0;
    if (adx > this.ADX_THRESHOLDS.STRONG) strength += 0.75;
    if (adx < this.ADX_THRESHOLDS.WEAK) strength -= 0.75;
    
    return Math.max(0, Math.min(5, strength)); // Normalize to 0-5
  }

  /**
   * Determine market bias based on technical indicators
   */
  private static determineMarketBias(data: MarketData): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
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
    if (data.rsi < this.RSI_THRESHOLDS.OVERSOLD) signals.bullish++;
    if (data.rsi > this.RSI_THRESHOLDS.OVERBOUGHT) signals.bearish++;
    
    // ADX Trend Strength
    const adx = data.adx ?? 0;
    if (adx > this.ADX_THRESHOLDS.STRONG) {
      if (data.price > data.sma50) signals.bullish++;
      if (data.price < data.sma50) signals.bearish++;
    }
    
    if (signals.bullish > signals.bearish) return 'BULLISH';
    if (signals.bearish > signals.bullish) return 'BEARISH';
    return 'NEUTRAL';
  }

  /**
   * Determine IV environment based on VIX and IV percentile
   */
  private static determineIVEnvironment(data: MarketData): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (data.vix < this.VIX_THRESHOLDS.LOW) return 'LOW';
    if (data.vix > this.VIX_THRESHOLDS.HIGH) return 'HIGH';
    return 'MEDIUM';
  }

  /**
   * Determine optimal strategy based on market conditions
   */
  private static determineStrategy(
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
      return 'IRON_BUTTERFLY';
    }
    
    // Medium IV Environment
    if (marketBias === 'BULLISH') return 'BULL_CALL_SPREAD';
    if (marketBias === 'BEARISH') return 'BEAR_PUT_SPREAD';
    return 'IRON_CONDOR';
  }

  /**
   * Calculate position size based on signal strength and market conditions
   */
  private static calculatePositionSize(signalStrength: number, data: MarketData): number {
    const baseSize = 0.02; // 2% base position size
    const vixAdjustment = data.vix < this.VIX_THRESHOLDS.LOW ? 1.2 : 
                         data.vix > this.VIX_THRESHOLDS.HIGH ? 0.8 : 1;
    
    return baseSize * (signalStrength / 5) * vixAdjustment;
  }

  /**
   * Calculate risk metrics for the strategy
   */
  private static calculateRiskMetrics(data: MarketData, strategy: string): { maxRisk: number } {
    const baseRisk = 0.02; // 2% base risk
    const vixAdjustment = data.vix < this.VIX_THRESHOLDS.LOW ? 1.2 : 
                         data.vix > this.VIX_THRESHOLDS.HIGH ? 0.8 : 1;
    
    return {
      maxRisk: baseRisk * vixAdjustment
    };
  }

  /**
   * Determine risk level based on market conditions
   */
  private static determineRiskLevel(data: MarketData): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (data.vix < this.VIX_THRESHOLDS.LOW) return 'LOW';
    if (data.vix > this.VIX_THRESHOLDS.HIGH) return 'HIGH';
    return 'MEDIUM';
  }

  /**
   * Calculate expected win rate based on market conditions and strategy
   */
  private static calculateExpectedWinRate(data: MarketData, strategy: string): number {
    let baseWinRate = 0.65; // 65% base win rate
    
    // Adjust based on VIX
    if (data.vix < this.VIX_THRESHOLDS.LOW) baseWinRate += 0.05;
    if (data.vix > this.VIX_THRESHOLDS.HIGH) baseWinRate -= 0.05;
    
    // Adjust based on ADX
    const adx = data.adx ?? 0;
    if (adx > this.ADX_THRESHOLDS.STRONG) baseWinRate += 0.05;
    if (adx < this.ADX_THRESHOLDS.WEAK) baseWinRate -= 0.05;
    
    return Math.min(0.85, Math.max(0.45, baseWinRate));
  }

  /**
   * Generate reasoning for the strategy recommendation
   */
  private static generateReasoning(
    data: MarketData,
    strategy: string,
    marketBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    ivEnvironment: 'LOW' | 'MEDIUM' | 'HIGH'
  ): string {
    const reasons: string[] = [];
    
    // Market Bias
    reasons.push(`Market bias is ${marketBias.toLowerCase()}`);
    
    // IV Environment
    reasons.push(`IV environment is ${ivEnvironment.toLowerCase()}`);
    
    // Technical Indicators
    if (data.price > data.sma50) reasons.push('Price above 50-day SMA');
    if (data.price > data.sma200) reasons.push('Price above 200-day SMA');
    if (data.macd > 0) reasons.push('MACD is positive');
    if (data.rsi < this.RSI_THRESHOLDS.OVERSOLD) reasons.push('RSI indicates oversold conditions');
    if (data.rsi > this.RSI_THRESHOLDS.OVERBOUGHT) reasons.push('RSI indicates overbought conditions');
    
    const adx = data.adx ?? 0;
    if (adx > this.ADX_THRESHOLDS.STRONG) reasons.push('Strong trend detected');
    
    // VIX
    if (data.vix < this.VIX_THRESHOLDS.LOW) reasons.push('Low volatility environment');
    if (data.vix > this.VIX_THRESHOLDS.HIGH) reasons.push('High volatility environment');
    
    return reasons.join('. ');
  }

  /**
   * Get strategy parameters based on the selected strategy
   */
  private static getStrategyParameters(strategy: string, data: MarketData): StrategyParameters {
    const basePrice = data.price;
    
    switch (strategy) {
      case 'BULL_CALL_SPREAD':
        return {
          strategy: 'BULL_CALL_SPREAD',
          buyStrike: basePrice * 0.98, // 2% ITM
          sellStrike: basePrice * 1.08, // 8% OTM
          targetCredit: 0.35, // 35% of spread width
          maxLoss: basePrice * 0.10, // 10% max loss
          daysToExpiration: 30
        };
      
      case 'BULL_PUT_SPREAD':
        return {
          strategy: 'BULL_PUT_SPREAD',
          sellStrike: basePrice * 0.97, // 3% OTM
          buyStrike: basePrice * 0.87, // 13% OTM
          targetCredit: 0.30, // 30% of spread width
          maxLoss: basePrice * 0.10, // 10% max loss
          daysToExpiration: 30
        };
      
      case 'BEAR_CALL_SPREAD':
        return {
          strategy: 'BEAR_CALL_SPREAD',
          sellStrike: basePrice * 1.03, // 3% OTM
          buyStrike: basePrice * 1.13, // 13% OTM
          targetCredit: 0.30, // 30% of spread width
          maxLoss: basePrice * 0.10, // 10% max loss
          daysToExpiration: 30
        };
      
      case 'BEAR_PUT_SPREAD':
        return {
          strategy: 'BEAR_PUT_SPREAD',
          buyStrike: basePrice * 1.02, // 2% ITM
          sellStrike: basePrice * 0.92, // 8% OTM
          targetCredit: 0.35, // 35% of spread width
          maxLoss: basePrice * 0.10, // 10% max loss
          daysToExpiration: 30
        };
      
      case 'IRON_CONDOR':
        return {
          strategy: 'IRON_CONDOR',
          sellStrike: basePrice * 1.03, // 3% OTM
          buyStrike: basePrice * 1.13, // 13% OTM
          targetCredit: 0.25, // 25% of spread width
          maxLoss: basePrice * 0.15, // 15% max loss
          daysToExpiration: 45
        };
      
      case 'IRON_BUTTERFLY':
        return {
          strategy: 'IRON_BUTTERFLY',
          sellStrike: basePrice * 1.02, // 2% OTM
          buyStrike: basePrice * 1.12, // 12% OTM
          targetCredit: 0.25, // 25% of spread width
          maxLoss: basePrice * 0.15, // 15% max loss
          daysToExpiration: 45
        };
      
      default:
        return {
          strategy: 'SKIP_TRADE',
          targetCredit: 0,
          maxLoss: 0,
          daysToExpiration: 30
        };
    }
  }

  /**
   * Main function to analyze market conditions and recommend strategy
   */
  analyzeStrategy(marketData: MarketData): StrategyRecommendation {
    // Step 1: Analyze technical signals
    const signals = this.analyzeTechnicalSignals(marketData);

    // Step 2: Determine overall market bias and signal strength
    const marketBias = OptionsStrategyAnalyzer.determineMarketBias(marketData);
    const signalStrength = OptionsStrategyAnalyzer.calculateSignalStrength(marketData);

    // Step 3: Apply volatility-based optimization
    const volatilityAdjustment = OptionsStrategyAnalyzer.getVolatilityAdjustment(marketData.ivPercentile);

    // Step 4: Calculate position size based on signal strength
    const positionSize = OptionsStrategyAnalyzer.calculatePositionSize(signalStrength, marketData);

    // Step 5: Select optimal strategy
    const strategy = this.selectStrategy(marketBias, marketData, volatilityAdjustment);

    // Step 6: Apply risk management filters
    const finalRecommendation = this.applyRiskManagement(
      strategy,
      positionSize,
      signalStrength,
      marketData,
      signals
    );

    return finalRecommendation;
  }

  /**
   * Analyze all technical indicators and generate signals
   */
  private analyzeTechnicalSignals(data: MarketData): TechnicalSignal[] {
    const signals: TechnicalSignal[] = [];

    // Moving Average Analysis
    const maSignal = this.analyzeMovingAverages(data);
    if (maSignal) signals.push(maSignal);

    // MACD Analysis
    const macdSignal = this.analyzeMacd(data);
    if (macdSignal) signals.push(macdSignal);

    // RSI Analysis
    const rsiSignal = this.analyzeRsi(data);
    if (rsiSignal) signals.push(rsiSignal);

    // VIX Analysis
    const vixSignal = this.analyzeVix(data);
    if (vixSignal) signals.push(vixSignal);

    // Trend Strength Analysis
    if (data.adx) {
      const trendSignal = this.analyzeTrendStrength(data);
      if (trendSignal) signals.push(trendSignal);
    }

    return signals;
  }

  private analyzeMovingAverages(data: MarketData): TechnicalSignal | null {
    const { price, sma50, sma200 } = data;

    // Golden Cross / Death Cross Analysis
    if (sma50 > sma200 && price > sma50) {
      return {
        type: 'BULLISH',
        strength: price > sma200 * 1.02 ? 5 : 4, // Strong if price >2% above 200-day
        description: 'Golden Cross - 50-day above 200-day MA, price above both',
        weight: 3.0
      };
    } else if (sma50 < sma200 && price < sma50) {
      return {
        type: 'BEARISH',
        strength: price < sma200 * 0.98 ? 5 : 4, // Strong if price <2% below 200-day
        description: 'Death Cross - 50-day below 200-day MA, price below both',
        weight: 3.0
      };
    } else if (price > sma200 && sma50 < sma200) {
      return {
        type: 'NEUTRAL',
        strength: 2,
        description: 'Mixed signals - Price above 200-day but 50-day below 200-day',
        weight: 1.5
      };
    } else if (price < sma200 && sma50 > sma200) {
      return {
        type: 'NEUTRAL',
        strength: 2,
        description: 'Mixed signals - Price below 200-day but 50-day above 200-day',
        weight: 1.5
      };
    }

    return null;
  }

  private analyzeMacd(data: MarketData): TechnicalSignal | null {
    const { macd } = data;

    if (macd > 5) {
      return {
        type: 'BULLISH',
        strength: macd > 10 ? 5 : 4,
        description: `Strong bullish MACD signal (${macd.toFixed(2)})`,
        weight: 2.5
      };
    } else if (macd < -5) {
      return {
        type: 'BEARISH',
        strength: macd < -10 ? 5 : 4,
        description: `Strong bearish MACD signal (${macd.toFixed(2)})`,
        weight: 2.5
      };
    } else if (macd > 0) {
      return {
        type: 'BULLISH',
        strength: 2,
        description: `Weak bullish MACD signal (${macd.toFixed(2)})`,
        weight: 1.0
      };
    } else if (macd < 0) {
      return {
        type: 'BEARISH',
        strength: 2,
        description: `Weak bearish MACD signal (${macd.toFixed(2)})`,
        weight: 1.0
      };
    }

    return null;
  }

  private analyzeRsi(data: MarketData): TechnicalSignal | null {
    const { rsi } = data;
    const rsiStr = typeof rsi === 'number' ? rsi.toFixed(1) : 'N/A';

    if (typeof rsi === 'number' && rsi > 70) {
      return {
        type: 'BEARISH',
        strength: rsi > 80 ? 4 : 3,
        description: `RSI overbought (${rsiStr}) - potential reversal`,
        weight: 1.5
      };
    } else if (typeof rsi === 'number' && rsi < 30) {
      return {
        type: 'BULLISH',
        strength: rsi < 20 ? 4 : 3,
        description: `RSI oversold (${rsiStr}) - potential reversal`,
        weight: 1.5
      };
    } else if (typeof rsi === 'number' && rsi > 60) {
      return {
        type: 'BULLISH',
        strength: 2,
        description: `RSI bullish momentum (${rsiStr})`,
        weight: 0.5
      };
    } else if (typeof rsi === 'number' && rsi < 40) {
      return {
        type: 'BEARISH',
        strength: 2,
        description: `RSI bearish momentum (${rsiStr})`,
        weight: 0.5
      };
    }

    return {
      type: 'NEUTRAL',
      strength: 1,
      description: `RSI neutral (${rsiStr})`,
      weight: 0.2
    };
  }

  private analyzeVix(data: MarketData): TechnicalSignal | null {
    const { vix } = data;

    if (vix > 35) {
      return {
        type: 'NEUTRAL',
        strength: 1,
        description: `High volatility (VIX ${vix.toFixed(1)}) - extreme fear, potential bottom`,
        weight: 2.0
      };
    } else if (vix > 25) {
      return {
        type: 'NEUTRAL',
        strength: 2,
        description: `Elevated volatility (VIX ${vix.toFixed(1)}) - caution advised`,
        weight: 1.0
      };
    } else if (vix < 15) {
      return {
        type: 'NEUTRAL',
        strength: 2,
        description: `Low volatility (VIX ${vix.toFixed(1)}) - complacency risk`,
        weight: 1.0
      };
    }

    return {
      type: 'NEUTRAL',
      strength: 3,
      description: `Normal volatility (VIX ${vix.toFixed(1)})`,
      weight: 0.5
    };
  }

  private analyzeTrendStrength(data: MarketData): TechnicalSignal | null {
    if (!data.adx) return null;

    const { adx } = data;

    if (adx > 25) {
      return {
        type: 'NEUTRAL',
        strength: 4,
        description: `Strong trend detected (ADX ${adx.toFixed(1)})`,
        weight: 2.0
      };
    } else if (adx < 20) {
      return {
        type: 'NEUTRAL',
        strength: 2,
        description: `Weak trend/sideways market (ADX ${adx.toFixed(1)})`,
        weight: 1.0
      };
    }

    return null;
  }

  /**
   * Select optimal strategy based on market conditions
   */
  private selectStrategy(
    marketBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
    data: MarketData,
    volatilityAdjustment: any
  ): string {
    // High volatility override - prefer iron condors
    if (data.vix > 30 && data.ivPercentile > 60) {
      return 'IRON_CONDOR';
    }

    // Volatility-based strategy selection
    if (volatilityAdjustment.preferCredit) {
      if (marketBias === 'BULLISH') {
        return 'BULL_PUT_SPREAD'; // Credit spread
      } else if (marketBias === 'BEARISH') {
        return 'BEAR_CALL_SPREAD'; // Credit spread
      } else {
        return 'IRON_CONDOR'; // Credit spread
      }
    } else if (volatilityAdjustment.preferDebit) {
      if (marketBias === 'BULLISH') {
        return 'BULL_CALL_SPREAD'; // Debit spread
      } else if (marketBias === 'BEARISH') {
        return 'BEAR_PUT_SPREAD'; // Debit spread
      } else {
        return 'IRON_BUTTERFLY'; // Debit spread
      }
    } else {
      // Normal IV - use technical analysis
      if (marketBias === 'BULLISH') {
        return data.rsi < 60 ? 'BULL_CALL_SPREAD' : 'BULL_PUT_SPREAD';
      } else if (marketBias === 'BEARISH') {
        return data.rsi > 40 ? 'BEAR_PUT_SPREAD' : 'BEAR_CALL_SPREAD';
      } else {
        return data.ivPercentile > 40 ? 'IRON_CONDOR' : 'IRON_BUTTERFLY';
      }
    }
  }

  /**
   * Validate trade timing based on market hours and special events
   */
  private validateTradeTiming(data: MarketData): boolean {
    const date = new Date(data.date);
    const hour = date.getHours();
    const minutes = date.getMinutes();
    
    // Avoid first 30 minutes and last 30 minutes
    if ((hour === 9 && minutes < 30) || (hour === 15 && minutes > 30)) {
      return false;
    }
    
    // Check for earnings (would need earnings calendar data)
    // Check for FOMC days (would need FOMC calendar data)
    
    return true;
  }

  /**
   * Apply final risk management and generate recommendation
   */
  private applyRiskManagement(
    strategy: string,
    positionSize: number,
    signalStrength: number,
    data: MarketData,
    signals: TechnicalSignal[]
  ): StrategyRecommendation {
    // Skip trade conditions
    if (positionSize === 0 || signalStrength < 1.5) {
      return {
        strategy: 'SKIP_TRADE',
        positionSize: 0,
        confidence: 0,
        reasoning: ['Signal strength too weak', 'Risk management override'].join('. '),
        riskLevel: 'LOW',
        expectedWinRate: 0,
        signalStrength: 1, // WEAK = 1
        maxRisk: 0,
        strategyParameters: {
          strategy: 'SKIP_TRADE',
          targetCredit: 0,
          maxLoss: 0,
          daysToExpiration: this.MIN_DAYS_TO_EXPIRATION
        }
      };
    }

    // Validate trade timing
    if (!this.validateTradeTiming(data)) {
      return {
        strategy: 'SKIP_TRADE',
        positionSize: 0,
        confidence: 0,
        reasoning: ['Invalid trade timing', 'Market hours restriction'].join('. '),
        riskLevel: 'LOW',
        expectedWinRate: 0,
        signalStrength: 1, // WEAK = 1
        maxRisk: 0,
        strategyParameters: {
          strategy: 'SKIP_TRADE',
          targetCredit: 0,
          maxLoss: 0,
          daysToExpiration: this.MIN_DAYS_TO_EXPIRATION
        }
      };
    }

    // Get strategy parameters
    const strategyParams = OptionsStrategyAnalyzer.getStrategyParameters(strategy, data);

    // Determine confidence and expected win rate
    const confidence = Math.min(95, Math.max(20, signalStrength * 18));
    const expectedWinRate = this.calculateExpectedWinRate(strategy as any, signalStrength, data);

    // Generate reasoning
    const reasoning = this.generateReasoning(signals, data, strategy);

    // Determine risk level
    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
      positionSize < 0.06 ? 'LOW' :
        positionSize < 0.10 ? 'MEDIUM' : 'HIGH';

    // Determine signal strength category
    const signalStrengthCategory: 'WEAK' | 'MEDIUM' | 'STRONG' =
      signalStrength < 2.5 ? 'WEAK' :
        signalStrength < 4.0 ? 'MEDIUM' : 'STRONG';

    const maxRisk = this.accountInfo.balance * positionSize;

    return {
      strategy: strategy as any,
      positionSize: Math.round(positionSize * 10000) / 100, // Convert to percentage
      confidence: Math.round(confidence),
      reasoning: reasoning.join('. '),
      riskLevel,
      expectedWinRate: Math.round(expectedWinRate),
      signalStrength: signalStrengthCategory === 'WEAK' ? 1 : 
                     signalStrengthCategory === 'MEDIUM' ? 3 : 5,
      maxRisk: Math.round(maxRisk),
      strategyParameters: strategyParams
    };
  }

  private calculateExpectedWinRate(strategy: string, signalStrength: number, data: MarketData): number {
    let baseWinRate: number;

    // Base win rates by strategy (from backtest data)
    switch (strategy) {
      case 'BULL_CALL_SPREAD':
      case 'BULL_PUT_SPREAD':
        baseWinRate = 63;
        break;
      case 'BEAR_CALL_SPREAD':
      case 'BEAR_PUT_SPREAD':
        baseWinRate = 58;
        break;
      case 'IRON_CONDOR':
        baseWinRate = data.ivPercentile > 40 ? 65 : 52;
        break;
      case 'IRON_BUTTERFLY':
        baseWinRate = 55;
        break;
      default:
        baseWinRate = 50;
    }

    // Adjust for signal strength
    const strengthAdjustment = (signalStrength - 3) * 5; // -10 to +10 adjustment

    // Adjust for volatility
    const volatilityAdjustment = data.vix > 25 ? -5 : data.vix < 20 ? 5 : 0;

    return Math.min(85, Math.max(35, baseWinRate + strengthAdjustment + volatilityAdjustment));
  }

  private generateReasoning(signals: TechnicalSignal[], data: MarketData, strategy: string): string[] {
    const reasoning: string[] = [];

    // Add primary signals
    const strongSignals = signals.filter(s => s.strength >= 3);
    strongSignals.forEach(signal => {
      reasoning.push(signal.description);
    });

    // Add volatility context
    if (data.ivPercentile > 75) {
      reasoning.push(`High IV (${data.ivPercentile}th percentile) - favorable for credit strategies`);
    } else if (data.ivPercentile < 25) {
      reasoning.push(`Low IV (${data.ivPercentile}th percentile) - favorable for debit strategies`);
    }

    // Add VIX context
    if (data.vix > 25) {
      reasoning.push(`Elevated VIX (${data.vix.toFixed(1)}) - increased caution warranted`);
    }

    // Add strategy-specific reasoning
    if (strategy.includes('IRON_CONDOR')) {
      reasoning.push('Iron condor selected for neutral/sideways market expectation');
    }

    return reasoning;
  }

  /**
   * Public method to get current strategy recommendation
   */
  public getCurrentRecommendation(marketData: MarketData): StrategyRecommendation {
    return this.analyzeStrategy(marketData);
  }

  /**
   * Update account information
   */
  public updateAccount(newAccountInfo: Partial<AccountInfo>): void {
    this.accountInfo = { ...this.accountInfo, ...newAccountInfo };
  }

  /**
   * Get formatted output for logging/display
   */
  public getFormattedRecommendation(recommendation: StrategyRecommendation): string {
    const output = [
      `\n=== OPTIONS STRATEGY RECOMMENDATION ===`,
      `Strategy: ${recommendation.strategy.replace(/_/g, ' ')}`,
      `Position Size: ${recommendation.positionSize}% of account`,
      `Max Risk: $${recommendation.maxRisk.toLocaleString()}`,
      `Confidence: ${recommendation.confidence}%`,
      `Expected Win Rate: ${recommendation.expectedWinRate}%`,
      `Signal Strength: ${recommendation.signalStrength}`,
      `Risk Level: ${recommendation.riskLevel}`,
      `\nReasoning:`,
      `  • ${recommendation.reasoning}`,
      `\n======================================`
    ];

    return output.join('\n');
  }

  private static getVolatilityAdjustment(ivPercentile: number): { preferCredit: boolean; preferDebit: boolean } {
    return {
      preferCredit: ivPercentile > 60,
      preferDebit: ivPercentile < 40
    };
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