import { MarketData } from '../types/types';
import { RiskMetrics } from '../services/risk-manager';
import { StrategyParameters } from './options-strategy-analyzer';
import { MarketDataService } from '../services/market-data-service';
import { TechnicalAnalysis } from '../utils/technical-analysis';
import { VolatilityAnalysis } from '../utils/volatility-analysis';
import { ConfigService } from '../config/config';

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
  private marketDataService: MarketDataService;
  private config: ConfigService;

  constructor(initialBalance: number = 100000) {
    this.accountBalance = initialBalance;
    this.peakBalance = initialBalance;
    this.historicalData = [];
    this.marketDataService = new MarketDataService();
    this.config = ConfigService.getInstance();
  }

  public setHistoricalData(data: MarketData[]): void {
    this.historicalData = data;
  }

  /**
   * Initialize the backtester with historical data
   */
  async initialize(): Promise<void> {
    try {
      console.log('Fetching historical data from Yahoo Finance...');
      const response = await fetch(this.config.getApiConfig().yahooFinanceApi + '?interval=1d&range=2y&indicators=quote&includeTimestamps=true');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (!data.chart?.result?.[0]?.indicators?.quote?.[0]) {
        throw new Error('Invalid data format from Yahoo Finance');
      }

      const quote = data.chart.result[0].indicators.quote[0];
      const timestamps = data.chart.result[0].timestamp;

      console.log(`Raw data points from Yahoo: ${timestamps.length}`);
      console.log('Sample data point:', {
        date: new Date(timestamps[0] * 1000).toISOString(),
        close: quote.close[0],
        volume: quote.volume[0]
      });

      // Process each day's data
      for (let i = 0; i < timestamps.length; i++) {
        // Skip if any required data is missing
        if (quote.close[i] === null || quote.close[i] === undefined ||
            quote.high[i] === null || quote.high[i] === undefined ||
            quote.low[i] === null || quote.low[i] === undefined ||
            quote.volume[i] === null || quote.volume[i] === undefined) {
          continue;
        }

        const validPrices = quote.close.slice(0, i + 1).filter((price: number | null) => price !== null && price !== undefined);
        
        // Skip if we don't have enough data for indicators
        if (validPrices.length < 200) continue;

        // Calculate technical indicators
        const sma50 = this.calculateSMA(validPrices, 50);
        const sma200 = this.calculateSMA(validPrices, 200);
        const macd = this.calculateMACD(validPrices);
        const rsi = this.calculateRSI(validPrices);

        // Skip if indicators couldn't be calculated
        if (!sma50.length || !sma200.length || !macd.length || !rsi.length) continue;

        const date = new Date(timestamps[i] * 1000);
        
        // Skip future dates
        if (date > new Date()) continue;

        const vix = await this.marketDataService.fetchVIX();
        const ivPercentile = await this.marketDataService.calculateIVPercentile();

        this.historicalData.push({
          price: quote.close[i],
          sma50: sma50[sma50.length - 1],
          sma200: sma200[sma200.length - 1],
          macd: macd[macd.length - 1],
          rsi: rsi[rsi.length - 1],
          vix,
          ivPercentile,
          adx: this.calculateADX(quote.high, quote.low, quote.close),
          volume: quote.volume[i],
          date
        });
      }

      // Sort data by date
      this.historicalData.sort((a, b) => a.date.getTime() - b.date.getTime());

      if (this.historicalData.length === 0) {
        throw new Error('No valid historical data found');
      }

      console.log('\nProcessed Historical Data Summary:');
      console.log(`Total days processed: ${this.historicalData.length}`);
      console.log(`Date range: ${this.historicalData[0].date.toISOString()} to ${this.historicalData[this.historicalData.length - 1].date.toISOString()}`);
      console.log('Sample data point:', {
        date: this.historicalData[0].date.toISOString(),
        price: this.historicalData[0].price,
        vix: this.historicalData[0].vix,
        ivPercentile: this.historicalData[0].ivPercentile
      });
    } catch (error) {
      console.error('Error initializing backtester:', error);
      throw error;
    }
  }

  // Helper methods for technical indicators
  private calculateSMA(data: number[], period: number): number[] {
    if (data.length < period) return [];
    const sma: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  private calculateMACD(data: number[]): number[] {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    return ema12.map((value, index) => value - ema26[index]);
  }

  private calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema: number[] = [data[0]];
    for (let i = 1; i < data.length; i++) {
      ema.push(data[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
  }

  private calculateRSI(data: number[], period: number = 14): number[] {
    const rsi: number[] = [];
    for (let i = period; i < data.length; i++) {
      const gains = data.slice(i - period, i).map((price, index) => 
        index === 0 ? 0 : Math.max(price - data[i - period + index - 1], 0)
      );
      const losses = data.slice(i - period, i).map((price, index) => 
        index === 0 ? 0 : Math.max(data[i - period + index - 1] - price, 0)
      );
      const avgGain = gains.reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
    return rsi;
  }

  private calculateADX(high: number[], low: number[], close: number[], period: number = 14): number {
    if (high.length < period || low.length < period || close.length < period) return 0;
    
    const tr: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];
    
    for (let i = 1; i < high.length; i++) {
      tr.push(Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1])
      ));
      
      const upMove = high[i] - high[i - 1];
      const downMove = low[i - 1] - low[i];
      
      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }
    
    const trEMA = this.calculateEMA(tr, period);
    const plusDI = this.calculateEMA(plusDM, period).map((value, index) => 
      (value / trEMA[index]) * 100
    );
    const minusDI = this.calculateEMA(minusDM, period).map((value, index) => 
      (value / trEMA[index]) * 100
    );
    
    const dx = plusDI.map((value, index) => 
      Math.abs(value - minusDI[index]) / (value + minusDI[index]) * 100
    );
    
    return this.calculateEMA(dx, period)[dx.length - 1];
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
      baseSize = 0.05; // 5% for strong signals
    } else if (signalStrength >= 2.0) {
      baseSize = 0.03; // 3% for medium signals
    } else if (signalStrength >= 1.0) {
      baseSize = 0.02; // 2% for weak signals
    }

    // VIX adjustments
    if (data.vix) {
      if (data.vix > 30) {
        baseSize *= 0.5;
      } else if (data.vix > 25) {
        baseSize *= 0.7;
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
    return Math.min(Math.max(baseSize, 0.01), 0.05);
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

    let returnPercent = 0;
    switch (strategy) {
      case 'BULL_PUT_SPREAD':
      case 'BEAR_CALL_SPREAD':
        // Credit spreads: 10-15% of credit received
        returnPercent = priceChangePercent > 0 ? targetCredit * 0.3 : -maxLoss * 0.3;
        break;
      
      case 'BULL_CALL_SPREAD':
      case 'BEAR_PUT_SPREAD':
        // Debit spreads: 15-20% of maximum profit
        returnPercent = priceChangePercent > 0 ? targetCredit * 0.4 : -maxLoss * 0.3;
        break;
      
      case 'IRON_CONDOR':
      case 'IRON_BUTTERFLY':
        // Iron condors: 10-15% of credit received
        returnPercent = Math.abs(priceChangePercent) < 0.02 ? targetCredit * 0.3 : -maxLoss * 0.3;
        break;
    }

    // Calculate actual P&L based on position value and return percentage
    return positionValue * returnPercent;
  }

  private updateDrawdown(pnl: number) {
    this.accountBalance += pnl;
    this.peakBalance = Math.max(this.peakBalance, this.accountBalance);
    this.currentDrawdown = Math.min(1, (this.peakBalance - this.accountBalance) / this.peakBalance);
    this.maxDrawdown = Math.min(1, Math.max(this.maxDrawdown, this.currentDrawdown));
  }

  async runBacktest(): Promise<BacktestResult> {
    // Sort data by date
    this.historicalData.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Get the last year of data
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const lastYearData = this.historicalData.filter(data => data.date >= oneYearAgo);

    // Group data by month
    const monthlyData = new Map<string, MarketData[]>();
    lastYearData.forEach(data => {
      const monthKey = `${data.date.getFullYear()}-${data.date.getMonth()}`;
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, []);
      }
      monthlyData.get(monthKey)!.push(data);
    });

    // Process one trade per month
    for (const [monthKey, monthData] of monthlyData) {
      // Sort the month's data by date
      monthData.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      // Take the middle day of the month for the trade
      const midMonthIndex = Math.floor(monthData.length / 2);
      const entryData = monthData[midMonthIndex];

      // Calculate signal strength and determine strategy
      const signalStrength = this.calculateSignalStrength(entryData);
      const strategy = this.determineStrategy(entryData, signalStrength);
      
      // Calculate position size
      const positionSize = this.calculatePositionSize(signalStrength, entryData);
      
      // Get strategy parameters
      const strategyParams = this.getStrategyParameters(strategy, entryData);
      
      // Calculate risk metrics
      const riskMetrics: RiskMetrics = {
        maxPositionSize: this.accountBalance * positionSize,
        suggestedStopLoss: strategyParams.maxLoss,
        riskRewardRatio: 2.0,
        maxDrawdown: this.maxDrawdown,
        volatilityAdjustment: entryData.vix ? (entryData.vix > 30 ? 0.6 : entryData.vix > 25 ? 0.8 : 1.0) : 1.0,
        correlationRisk: 0.5,
        maxRisk: this.accountBalance * positionSize,
        stopLoss: strategyParams.maxLoss,
        profitTarget: strategyParams.targetCredit
      };

      // Simulate the trade
      const trade = await this.simulateTrade(entryData, {
        strategy,
        positionSize,
        confidence: signalStrength / 5,
        reasoning: `Monthly trade for ${monthKey}`,
        riskLevel: signalStrength >= 4 ? 'HIGH' : signalStrength >= 2 ? 'MEDIUM' : 'LOW',
        expectedWinRate: 0.65,
        signalStrength,
        maxRisk: riskMetrics.maxRisk,
        strategyParameters: strategyParams
      }, positionSize, riskMetrics);

      // Add trade to results
      this.trades.push(trade);

      // Update account balance and drawdown
      this.accountBalance += trade.pnl;
      this.updateDrawdown(trade.pnl);
    }

    return this.calculateResults();
  }

  private calculateResults(): BacktestResult {
    const totalTrades = this.trades.length;
    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        averageReturn: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        profitFactor: 0,
        trades: []
      };
    }

    const winningTrades = this.trades.filter(t => t.pnl > 0).length;
    const winRate = (winningTrades / totalTrades) * 100;

    // Calculate returns as percentages of initial balance
    const returns = this.trades.map(t => t.pnl / this.accountBalance);
    const averageReturn = returns.reduce((a, b) => a + b, 0) / totalTrades;

    // Calculate Sharpe Ratio using daily returns
    const returnsArray = returns.map(r => r * 100); // Convert to percentage
    const sharpeRatio = this.calculateSharpeRatio(returnsArray);

    // Calculate profit factor
    const profitFactor = this.calculateProfitFactor();

    return {
      totalTrades,
      winningTrades,
      losingTrades: totalTrades - winningTrades,
      winRate,
      averageReturn: averageReturn * 100, // Convert to percentage
      maxDrawdown: Math.min(100, this.maxDrawdown * 100), // Ensure max drawdown is not over 100%
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
    const daysToExpiration = 30;
    const basePrice = data.price;
    
    // Calculate expiry date (next Friday)
    const today = new Date(data.date);
    const daysUntilFriday = (5 - today.getDay() + 7) % 7;
    const expiryDate = new Date(today);
    expiryDate.setDate(today.getDate() + daysUntilFriday + (daysToExpiration - daysUntilFriday));

    switch (strategy) {
      case 'BULL_CALL_SPREAD':
        return {
          strategy,
          buyStrike: basePrice * 0.98,
          sellStrike: basePrice * 1.08,
          targetCredit: 0.35,
          maxLoss: basePrice * 0.10,
          daysToExpiration,
          expiryDate,
          breakevenPrice: basePrice * 0.98 - 0.35,
          probabilityOfProfit: 0.65 // Default probability for backtesting
        };
      
      case 'BULL_PUT_SPREAD':
        return {
          strategy,
          sellStrike: basePrice * 0.97,
          buyStrike: basePrice * 0.87,
          targetCredit: 0.30,
          maxLoss: basePrice * 0.10,
          daysToExpiration,
          expiryDate,
          breakevenPrice: basePrice * 0.97 + 0.30,
          probabilityOfProfit: 0.65 // Default probability for backtesting
        };
      
      case 'BEAR_CALL_SPREAD':
        return {
          strategy,
          sellStrike: basePrice * 1.03,
          buyStrike: basePrice * 1.13,
          targetCredit: 0.30,
          maxLoss: basePrice * 0.10,
          daysToExpiration,
          expiryDate,
          breakevenPrice: basePrice * 1.03 - 0.30,
          probabilityOfProfit: 0.65 // Default probability for backtesting
        };
      
      case 'BEAR_PUT_SPREAD':
        return {
          strategy,
          buyStrike: basePrice * 1.02,
          sellStrike: basePrice * 0.92,
          targetCredit: 0.35,
          maxLoss: basePrice * 0.10,
          daysToExpiration,
          expiryDate,
          breakevenPrice: basePrice * 1.02 + 0.35,
          probabilityOfProfit: 0.65 // Default probability for backtesting
        };
      
      case 'IRON_CONDOR':
        return {
          strategy,
          sellStrike: basePrice * 1.03,
          buyStrike: basePrice * 1.13,
          targetCredit: 0.25,
          maxLoss: basePrice * 0.15,
          daysToExpiration,
          expiryDate,
          breakevenPrice: basePrice * 1.03 - 0.25,
          probabilityOfProfit: 0.65 // Default probability for backtesting
        };
      
      case 'IRON_BUTTERFLY':
        return {
          strategy,
          sellStrike: basePrice * 1.02,
          buyStrike: basePrice * 1.12,
          targetCredit: 0.25,
          maxLoss: basePrice * 0.15,
          daysToExpiration,
          expiryDate,
          breakevenPrice: basePrice * 1.02 - 0.25,
          probabilityOfProfit: 0.65 // Default probability for backtesting
        };
      
      default:
        return {
          strategy,
          targetCredit: 0,
          maxLoss: 0,
          daysToExpiration,
          expiryDate,
          breakevenPrice: data.price, // For calendar spreads, breakeven is at current price
          probabilityOfProfit: 0.65 // Default probability for backtesting
        };
    }
  }
} 