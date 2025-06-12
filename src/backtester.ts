import { MarketData } from './types';
import { RiskMetrics } from './risk-manager';
import { StrategyParameters } from './options-strategy-analyzer';

export interface BacktestResult {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  averageReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  trades: TradeResult[];
}

interface TradeResult {
  entryDate: Date;
  exitDate: Date;
  strategy: string;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  riskMetrics: RiskMetrics;
}

export class Backtester {
  private historicalData: MarketData[];
  private trades: TradeResult[] = [];
  private accountBalance: number;
  private maxDrawdown: number = 0;
  private currentDrawdown: number = 0;
  private peakBalance: number;
  private readonly MIN_PROFIT_TARGET = 0.25; // 25% minimum profit target
  private readonly MAX_LOSS_TARGET = 0.50; // 50% maximum loss target
  private readonly MIN_DAYS_TO_EXPIRATION = 20;
  private readonly MAX_DAYS_TO_EXPIRATION = 30;

  constructor(historicalData: MarketData[], initialBalance: number = 100000) {
    this.historicalData = historicalData;
    this.accountBalance = initialBalance;
    this.peakBalance = initialBalance;
  }

  private calculateSignalStrength(data: MarketData): number {
    let strength = 0;
    let totalWeight = 0;

    // Moving Average Analysis (Weight: 3.0)
    if (data.sma50 && data.sma200) {
      const maWeight = 3.0;
      totalWeight += maWeight;
      
      if (data.price > data.sma50 && data.sma50 > data.sma200) {
        strength += 5 * maWeight; // Strong Bullish
      } else if (data.price < data.sma50 && data.sma50 < data.sma200) {
        strength += 5 * maWeight; // Strong Bearish
      } else if (data.price > data.sma200) {
        strength += 2 * maWeight; // Neutral Bullish
      } else if (data.price < data.sma200) {
        strength += 2 * maWeight; // Neutral Bearish
      }
    }

    // MACD Analysis (Weight: 2.5)
    if (data.macd !== undefined) {
      const macdWeight = 2.5;
      totalWeight += macdWeight;
      
      if (data.macd > 10) {
        strength += 5 * macdWeight; // Strong Bullish
      } else if (data.macd < -10) {
        strength += 5 * macdWeight; // Strong Bearish
      } else if (data.macd > 0) {
        strength += 3 * macdWeight; // Moderate Bullish
      } else if (data.macd < 0) {
        strength += 3 * macdWeight; // Moderate Bearish
      }
    }

    // RSI Analysis (Weight: 1.5)
    if (data.rsi !== undefined) {
      const rsiWeight = 1.5;
      totalWeight += rsiWeight;
      
      if (data.rsi > 70) {
        strength += 3 * rsiWeight; // Bearish
      } else if (data.rsi < 30) {
        strength += 3 * rsiWeight; // Bullish
      } else if (data.rsi > 40 && data.rsi < 60) {
        strength += 2 * rsiWeight; // Neutral
      }
    }

    // VIX Analysis (Weight: 2.0)
    if (data.vix !== undefined) {
      const vixWeight = 2.0;
      totalWeight += vixWeight;
      
      if (data.vix > 35) {
        strength += 4 * vixWeight; // High Fear
      } else if (data.vix > 25) {
        strength += 2 * vixWeight; // Elevated
      } else if (data.vix < 15) {
        strength += 2 * vixWeight; // Complacency
      } else {
        strength += 1 * vixWeight; // Normal
      }
    }

    // ADX Analysis (Weight: 2.0)
    if (data.adx !== undefined) {
      const adxWeight = 2.0;
      totalWeight += adxWeight;
      
      if (data.adx > 25) {
        strength += 4 * adxWeight; // Strong Trend
      } else if (data.adx < 20) {
        strength += 2 * adxWeight; // Weak Trend
      }
    }

    return totalWeight > 0 ? strength / totalWeight : 0;
  }

  private determineStrategy(data: MarketData, signalStrength: number): string {
    const isHighIV = data.ivPercentile && data.ivPercentile > 75;
    const isLowIV = data.ivPercentile && data.ivPercentile < 25;
    const isHighVIX = data.vix && data.vix > 30;

    // Market bias determination
    const isBullish = data.price > data.sma50 && data.sma50 > data.sma200;
    const isBearish = data.price < data.sma50 && data.sma50 < data.sma200;
    const isNeutral = !isBullish && !isBearish;

    if (isHighVIX) {
      return 'IRON_CONDOR';
    }

    if (isHighIV) {
      if (isBullish) return 'BULL_PUT_SPREAD';
      if (isBearish) return 'BEAR_CALL_SPREAD';
      return 'IRON_CONDOR';
    }

    if (isLowIV) {
      if (isBullish) return 'BULL_CALL_SPREAD';
      if (isBearish) return 'BEAR_PUT_SPREAD';
      return 'IRON_BUTTERFLY';
    }

    // Normal IV environment
    if (isBullish) {
      return data.rsi && data.rsi < 60 ? 'BULL_CALL_SPREAD' : 'BULL_PUT_SPREAD';
    }
    if (isBearish) {
      return data.rsi && data.rsi > 40 ? 'BEAR_PUT_SPREAD' : 'BEAR_CALL_SPREAD';
    }

    return 'IRON_CONDOR';
  }

  private calculatePositionSize(signalStrength: number, data: MarketData): number {
    // Base position size based on signal strength
    let baseSize = 0;
    if (signalStrength >= 4.0) {
      baseSize = 0.12; // 12% for strong signals
    } else if (signalStrength >= 2.0) {
      baseSize = 0.08; // 8% for medium signals
    } else if (signalStrength >= 1.0) {
      baseSize = 0.04; // 4% for weak signals
    }

    // VIX adjustments
    if (data.vix) {
      if (data.vix > 30) {
        baseSize *= 0.6;
      } else if (data.vix > 25) {
        baseSize *= 0.8;
      }
    }

    // Drawdown adjustments
    if (this.currentDrawdown > 0.15) {
      baseSize *= 0.5;
    } else if (this.currentDrawdown > 0.10) {
      baseSize *= 0.6;
    } else if (this.currentDrawdown > 0.05) {
      baseSize *= 0.75;
    }

    // Ensure position size is within limits
    return Math.min(Math.max(baseSize, 0.02), 0.15);
  }

  private calculateExitPrice(
    strategy: string,
    entryPrice: number,
    currentPrice: number,
    strategyParams: StrategyParameters
  ): number {
    const priceChange = (currentPrice - entryPrice) / entryPrice;
    
    switch (strategy) {
      case 'BULL_PUT_SPREAD':
      case 'BEAR_CALL_SPREAD':
        // Credit spreads: 25-30% of credit received
        return priceChange > 0 ? entryPrice * 0.25 : entryPrice * 0.50;
      
      case 'BULL_CALL_SPREAD':
      case 'BEAR_PUT_SPREAD':
        // Debit spreads: 40-50% of maximum profit
        return priceChange > 0 ? entryPrice * 0.45 : entryPrice * 0.50;
      
      case 'IRON_CONDOR':
      case 'IRON_BUTTERFLY':
        // Iron condors: 25% of credit received
        return Math.abs(priceChange) < 0.02 ? entryPrice * 0.25 : entryPrice * 0.50;
      
      default:
        return 0;
    }
  }

  private findExitIndex(entryData: MarketData, stopLoss: number, strategyParams: StrategyParameters): number {
    const entryIndex = this.historicalData.findIndex(d => d.date === entryData.date);
    if (entryIndex === -1) return entryIndex;

    // Look ahead up to daysToExpiration for exit
    const maxDays = strategyParams.daysToExpiration;
    for (let i = entryIndex + 1; i < Math.min(entryIndex + maxDays, this.historicalData.length); i++) {
      const currentData = this.historicalData[i];
      if (!currentData?.price) continue;

      // Check stop loss
      if (stopLoss && currentData.price <= stopLoss) {
        return i;
      }

      // Check profit target
      const exitPrice = this.calculateExitPrice(
        strategyParams.strategy,
        entryData.price,
        currentData.price,
        strategyParams
      );
      
      if (exitPrice > 0) {
        return i;
      }

      // Check time-based exit (50% of time to expiration if not profitable)
      const daysHeld = i - entryIndex;
      if (daysHeld >= maxDays / 2 && currentData.price < entryData.price) {
        return i;
      }
    }

    // If no exit found, use the last available data point
    return Math.min(entryIndex + maxDays, this.historicalData.length - 1);
  }

  private calculatePnL(
    entryData: MarketData,
    exitData: MarketData,
    positionSize: number,
    strategy: string,
    strategyParams: StrategyParameters
  ): number {
    if (!entryData?.price || !exitData?.price) {
      return 0;
    }

    const priceChange = exitData.price - entryData.price;
    const priceChangePercent = priceChange / entryData.price;
    const positionValue = this.accountBalance * positionSize;

    // Calculate P&L based on strategy parameters
    const targetCredit = strategyParams.targetCredit;
    const maxLoss = strategyParams.maxLoss;

    switch (strategy) {
      case 'BULL_PUT_SPREAD':
      case 'BEAR_CALL_SPREAD':
        // Credit spreads: 30-40% of credit received
        return positionValue * (priceChangePercent > 0 ? targetCredit : -maxLoss);
      
      case 'BULL_CALL_SPREAD':
      case 'BEAR_PUT_SPREAD':
        // Debit spreads: 40-50% of maximum profit
        return positionValue * (priceChangePercent > 0 ? targetCredit * 1.3 : -maxLoss);
      
      case 'IRON_CONDOR':
      case 'IRON_BUTTERFLY':
        // Iron condors: 25-35% of credit received
        return positionValue * (Math.abs(priceChangePercent) < 0.02 ? targetCredit : -maxLoss);
      
      default:
        return 0;
    }
  }

  private updateDrawdown(pnl: number) {
    this.accountBalance += pnl;
    this.peakBalance = Math.max(this.peakBalance, this.accountBalance);
    this.currentDrawdown = (this.peakBalance - this.accountBalance) / this.peakBalance;
    this.maxDrawdown = Math.max(this.maxDrawdown, this.currentDrawdown);
  }

  async runBacktest(): Promise<BacktestResult> {
    for (let i = 0; i < this.historicalData.length - 1; i++) {
      const currentData = this.historicalData[i];
      if (!currentData) continue;

      const signalStrength = this.calculateSignalStrength(currentData);
      if (signalStrength < 1.0) continue; // Skip if signal is too weak

      const strategy = this.determineStrategy(currentData, signalStrength);
      const positionSize = this.calculatePositionSize(signalStrength, currentData);

      const riskMetrics: RiskMetrics = {
        maxPositionSize: positionSize * this.accountBalance,
        suggestedStopLoss: currentData.price * 0.98, // 2% stop loss
        riskRewardRatio: 2.0,
        maxDrawdown: this.maxDrawdown,
        volatilityAdjustment: currentData.vix ? (currentData.vix > 30 ? 0.6 : currentData.vix > 25 ? 0.8 : 1.0) : 1.0,
        correlationRisk: 0.5
      };

      const strategyParams = this.getStrategyParameters(strategy, currentData);

      const tradeResult = await this.simulateTrade(
        currentData,
        { strategy, strategyParameters: strategyParams },
        positionSize,
        riskMetrics
      );

      this.trades.push(tradeResult);
      this.updateDrawdown(tradeResult.pnl);
    }

    return this.calculateResults();
  }

  private calculateResults(): BacktestResult {
    const totalTrades = this.trades.length;
    const winningTrades = this.trades.filter(t => t.pnl > 0).length;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    const returns = this.trades.map(t => t.pnl / this.accountBalance);
    const averageReturn = returns.reduce((a, b) => a + b, 0) / totalTrades;
    const annualizedReturn = (1 + averageReturn) ** 252 - 1; // Assuming 252 trading days

    const returnsArray = returns.map(r => r * 100); // Convert to percentage
    const sharpeRatio = this.calculateSharpeRatio(returnsArray);

    const profitFactor = this.calculateProfitFactor();

    return {
      totalTrades,
      winningTrades,
      losingTrades: totalTrades - winningTrades,
      winRate,
      averageReturn: annualizedReturn * 100, // Convert to percentage
      maxDrawdown: this.maxDrawdown * 100, // Convert to percentage
      sharpeRatio,
      profitFactor,
      trades: this.trades
    };
  }

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    return stdDev === 0 ? 0 : (mean / stdDev) * Math.sqrt(252); // Annualized
  }

  private calculateProfitFactor(): number {
    const grossProfit = this.trades
      .filter(t => t.pnl > 0)
      .reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = Math.abs(this.trades
      .filter(t => t.pnl < 0)
      .reduce((sum, t) => sum + t.pnl, 0));
    return grossLoss === 0 ? 0 : grossProfit / grossLoss;
  }

  /**
   * Simulate a single trade
   */
  private async simulateTrade(
    entryData: MarketData,
    recommendation: any,
    positionSize: number,
    riskMetrics: RiskMetrics
  ): Promise<TradeResult> {
    // Find exit data (next day or when stop loss is hit)
    const exitIndex = this.findExitIndex(entryData, riskMetrics.suggestedStopLoss, recommendation.strategyParameters);
    const exitData = this.historicalData[exitIndex];

    // Validate data
    if (!entryData || !exitData) {
      return {
        entryDate: entryData?.date || new Date(),
        exitDate: exitData?.date || new Date(),
        strategy: recommendation.strategy,
        entryPrice: entryData?.price || 0,
        exitPrice: exitData?.price || 0,
        pnl: 0,
        riskMetrics
      };
    }

    // Calculate P&L based on strategy
    const pnl = this.calculatePnL(
      entryData,
      exitData,
      positionSize,
      recommendation.strategy,
      recommendation.strategyParameters
    );

    return {
      entryDate: entryData.date,
      exitDate: exitData.date,
      strategy: recommendation.strategy,
      entryPrice: entryData.price,
      exitPrice: exitData.price,
      pnl,
      riskMetrics
    };
  }

  private getStrategyParameters(strategy: string, data: MarketData): StrategyParameters {
    const basePrice = data.price;
    
    switch (strategy) {
      case 'BULL_CALL_SPREAD':
        return {
          strategy: 'BULL_CALL_SPREAD',
          buyStrike: basePrice * 0.98, // 2% ITM
          sellStrike: basePrice * 1.08, // 8% OTM
          targetCredit: 0.35, // 35% of spread width
          maxLoss: basePrice * 0.10, // 10% max loss
          daysToExpiration: this.MIN_DAYS_TO_EXPIRATION
        };
      
      case 'BULL_PUT_SPREAD':
        return {
          strategy: 'BULL_PUT_SPREAD',
          sellStrike: basePrice * 0.97, // 3% OTM
          buyStrike: basePrice * 0.87, // 13% OTM
          targetCredit: 0.30, // 30% of spread width
          maxLoss: basePrice * 0.10, // 10% max loss
          daysToExpiration: this.MIN_DAYS_TO_EXPIRATION
        };
      
      case 'BEAR_CALL_SPREAD':
        return {
          strategy: 'BEAR_CALL_SPREAD',
          sellStrike: basePrice * 1.03, // 3% OTM
          buyStrike: basePrice * 1.13, // 13% OTM
          targetCredit: 0.30, // 30% of spread width
          maxLoss: basePrice * 0.10, // 10% max loss
          daysToExpiration: this.MIN_DAYS_TO_EXPIRATION
        };
      
      case 'BEAR_PUT_SPREAD':
        return {
          strategy: 'BEAR_PUT_SPREAD',
          buyStrike: basePrice * 1.02, // 2% ITM
          sellStrike: basePrice * 0.92, // 8% OTM
          targetCredit: 0.35, // 35% of spread width
          maxLoss: basePrice * 0.10, // 10% max loss
          daysToExpiration: this.MIN_DAYS_TO_EXPIRATION
        };
      
      case 'IRON_CONDOR':
        return {
          strategy: 'IRON_CONDOR',
          sellStrike: basePrice * 1.03, // 3% OTM
          buyStrike: basePrice * 1.13, // 13% OTM
          targetCredit: 0.25, // 25% of spread width
          maxLoss: basePrice * 0.15, // 15% max loss
          daysToExpiration: this.MAX_DAYS_TO_EXPIRATION
        };
      
      case 'IRON_BUTTERFLY':
        return {
          strategy: 'IRON_BUTTERFLY',
          sellStrike: basePrice * 1.02, // 2% OTM
          buyStrike: basePrice * 1.12, // 12% OTM
          targetCredit: 0.25, // 25% of spread width
          maxLoss: basePrice * 0.15, // 15% max loss
          daysToExpiration: this.MAX_DAYS_TO_EXPIRATION
        };
      
      default:
        return {
          strategy: 'SKIP_TRADE',
          targetCredit: 0,
          maxLoss: 0,
          daysToExpiration: this.MIN_DAYS_TO_EXPIRATION
        };
    }
  }
} 