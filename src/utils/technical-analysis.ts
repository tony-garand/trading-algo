import { MarketData } from '../types/types';
import { VolatilityAnalysis } from './volatility-analysis';

export class TechnicalAnalysis {
  private static readonly RSI_THRESHOLDS = {
    OVERSOLD: 30,
    OVERBOUGHT: 70
  };

  static calculateSMA(prices: number[], period: number): number {
    if (prices.length < period) return 0;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
  }

  static calculateMACD(prices: number[]): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12 - ema26;
    const signal = this.calculateEMA([macd], 9);
    const histogram = macd - signal;
    return { macd, signal, histogram };
  }

  static calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const difference = prices[prices.length - i] - prices[prices.length - i - 1];
      if (difference >= 0) {
        gains += difference;
      } else {
        losses -= difference;
      }
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private static calculateEMA(prices: number[], period: number): number {
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }

  /**
   * Calculate ADX (Average Directional Index)
   * @param highPrices Array of high prices
   * @param lowPrices Array of low prices
   * @param closePrices Array of close prices
   * @param period Period for ADX calculation (default 14)
   * @returns Object containing ADX, +DI, and -DI values
   */
  static calculateADX(
    highPrices: number[],
    lowPrices: number[],
    closePrices: number[],
    period: number = 14
  ): { adx: number; plusDI: number; minusDI: number } {
    if (highPrices.length < period + 1 || lowPrices.length < period + 1 || closePrices.length < period + 1) {
      return { adx: 0, plusDI: 0, minusDI: 0 };
    }

    // Calculate True Range (TR)
    const trueRanges: number[] = [];
    for (let i = 1; i < highPrices.length; i++) {
      const tr = Math.max(
        highPrices[i] - lowPrices[i],
        Math.abs(highPrices[i] - closePrices[i - 1]),
        Math.abs(lowPrices[i] - closePrices[i - 1])
      );
      trueRanges.push(tr);
    }

    // Calculate Directional Movement
    const plusDM: number[] = [];
    const minusDM: number[] = [];
    
    for (let i = 1; i < highPrices.length; i++) {
      const upMove = highPrices[i] - highPrices[i - 1];
      const downMove = lowPrices[i - 1] - lowPrices[i];
      
      if (upMove > downMove && upMove > 0) {
        plusDM.push(upMove);
        minusDM.push(0);
      } else if (downMove > upMove && downMove > 0) {
        plusDM.push(0);
        minusDM.push(downMove);
      } else {
        plusDM.push(0);
        minusDM.push(0);
      }
    }

    // Calculate Smoothed TR and DM
    const smoothedTR = this.calculateSmoothedAverage(trueRanges, period);
    const smoothedPlusDM = this.calculateSmoothedAverage(plusDM, period);
    const smoothedMinusDM = this.calculateSmoothedAverage(minusDM, period);

    // Calculate +DI and -DI
    const plusDI = (smoothedPlusDM / smoothedTR) * 100;
    const minusDI = (smoothedMinusDM / smoothedTR) * 100;

    // Calculate DX
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;

    // Calculate ADX
    const adx = this.calculateSmoothedAverage([dx], period);

    return {
      adx,
      plusDI,
      minusDI
    };
  }

  /**
   * Calculate smoothed average using Wilder's smoothing method
   * @param values Array of values to smooth
   * @param period Smoothing period
   * @returns Smoothed average
   */
  private static calculateSmoothedAverage(values: number[], period: number): number {
    let sum = values.slice(0, period).reduce((a, b) => a + b, 0);
    let smoothed = sum / period;

    for (let i = period; i < values.length; i++) {
      smoothed = ((smoothed * (period - 1)) + values[i]) / period;
    }

    return smoothed;
  }

  /**
   * Interpret ADX value and return trend strength
   * @param adx ADX value
   * @returns Trend strength description
   */
  static interpretADX(adx: number): { strength: 'VERY_WEAK' | 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG'; description: string } {
    if (adx < 20) {
      return { strength: 'VERY_WEAK', description: 'No trend or very weak trend' };
    } else if (adx < 25) {
      return { strength: 'WEAK', description: 'Weak trend' };
    } else if (adx < 50) {
      return { strength: 'MODERATE', description: 'Moderate trend' };
    } else if (adx < 75) {
      return { strength: 'STRONG', description: 'Strong trend' };
    } else {
      return { strength: 'VERY_STRONG', description: 'Very strong trend' };
    }
  }

  /**
   * Calculate signal strength based on technical indicators and volatility
   * @param data Market data including price, indicators, and volatility metrics
   * @returns Signal strength from 1-5
   */
  static calculateSignalStrength(data: MarketData): number {
    const volatilityAdjustment = VolatilityAnalysis.calculateVolatilityAdjustment(data.vix, data.ivPercentile);
    const volatilityRegime = VolatilityAnalysis.getVolatilityRegime(data.vix, data.ivPercentile);
    
    // Base signal strength on technical indicators
    let strength = 0;
    
    // Price relative to moving averages
    if (data.price > data.sma50) strength += 1;
    if (data.price > data.sma200) strength += 1;
    
    // RSI conditions
    if (data.rsi > 50) strength += 1;
    if (data.rsi > 60) strength += 1;
    
    // MACD
    if (data.macd > 0) strength += 1;
    
    // ADX trend strength
    if (data.adx > 25) strength += 1;
    
    // Adjust for volatility regime
    switch (volatilityRegime) {
      case 'high':
        strength *= 0.8; // Reduce signal strength in high volatility
        break;
      case 'low':
        strength *= 1.2; // Increase signal strength in low volatility
        break;
      default:
        // No adjustment for medium volatility
        break;
    }
    
    // Apply volatility adjustment
    strength *= volatilityAdjustment;
    
    // Normalize to 1-5 scale
    return Math.max(1, Math.min(5, Math.round(strength)));
  }

  /**
   * Determine market bias based on technical indicators
   */
  static determineMarketBias(data: MarketData): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
    const isHighVolatility = VolatilityAnalysis.isHighVolatility(data.vix);
    const volatilityRegime = VolatilityAnalysis.getVolatilityRegime(data.vix, data.ivPercentile);
    
    // Log volatility conditions
    console.log('Volatility Analysis:', {
      vix: data.vix,
      ivPercentile: data.ivPercentile,
      isHighVolatility,
      volatilityRegime,
      volatilityAdjustment: VolatilityAnalysis.calculateVolatilityAdjustment(data.vix, data.ivPercentile)
    });

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
    if (data.rsi < TechnicalAnalysis.RSI_THRESHOLDS.OVERSOLD) signals.bullish++;
    if (data.rsi > TechnicalAnalysis.RSI_THRESHOLDS.OVERBOUGHT) signals.bearish++;

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
   * Calculate probability of returning at least $0.01 at expiry using 30-day implied volatility (VIX)
   * This matches the calculator's approach exactly
   */
  static calculateProbabilityOfProfit(
    currentPrice: number,
    sellStrike: number,
    buyStrike: number,
    sellIV: number,
    buyIV: number,
    daysToExpiry: number,
    marketData?: MarketData
  ): number {
    if (!marketData?.vix) {
      throw new Error('VIX (30-day implied volatility) is required for probability calculation');
    }

    // Convert days to years for calculations
    const timeToExpiry = daysToExpiry / 365;
    
    // For a bull put spread, we need the actual option prices
    const sellPutPrice = this.calculatePutPrice(currentPrice, sellStrike, sellIV, timeToExpiry);
    const buyPutPrice = this.calculatePutPrice(currentPrice, buyStrike, buyIV, timeToExpiry);
    const targetCredit = sellPutPrice - buyPutPrice;
    
    // Breakeven is sellStrike - targetCredit
    const breakevenPrice = sellStrike - targetCredit;
    
    // Use VIX (30-day implied volatility) for the calculation
    // VIX is already in percentage form (e.g., 18.01 means 18.01%)
    const volatility = marketData.vix / 100; // Convert from percentage to decimal
    
    // Calculate the probability using the standard normal distribution
    // This is the probability of price being above breakeven at expiry
    const standardDeviation = volatility * Math.sqrt(timeToExpiry);
    
    // For a bull put spread, we want the probability of price being above breakeven
    // The z-score should be (breakeven - current) / (current * volatility * sqrt(t))
    const zScore = (breakevenPrice - currentPrice) / (currentPrice * standardDeviation);
    
    // For a bull put spread, we want the probability of price being above breakeven
    // This means we want P(X > breakeven) = 1 - P(X <= breakeven)
    // Since we're using the standard normal distribution, this is 1 - CDF(zScore)
    const probability = 1 - this.calculateNormalCDF(zScore);
    
    // Convert to percentage
    return probability * 100;
  }

  /**
   * Calculate put option price using Black-Scholes formula
   */
  public static calculatePutPrice(
    currentPrice: number,
    strikePrice: number,
    volatility: number,
    timeToExpiry: number,
    riskFreeRate: number = 0.02
  ): number {
    const d1 = (Math.log(currentPrice / strikePrice) + (riskFreeRate + volatility * volatility / 2) * timeToExpiry) / (volatility * Math.sqrt(timeToExpiry));
    const d2 = d1 - volatility * Math.sqrt(timeToExpiry);
    
    const putPrice = strikePrice * Math.exp(-riskFreeRate * timeToExpiry) * this.calculateNormalCDF(-d2) - 
                    currentPrice * this.calculateNormalCDF(-d1);
    
    return putPrice;
  }

  /**
   * Calculate expected win rate based on market conditions and implied volatility
   */
  static calculateExpectedWinRate(
    data: MarketData, 
    strategy: string, 
    daysToExpiry: number, 
    optionsData?: {
      sellStrike: number;
      buyStrike: number;
      sellIV: number;
      buyIV: number;
    }
  ): number {
    // If we have options data, use the enhanced probability calculation
    if (optionsData) {
      const baseProbability = this.calculateProbabilityOfProfit(
        data.price,
        optionsData.sellStrike,
        optionsData.buyStrike,
        optionsData.sellIV,
        optionsData.buyIV,
        daysToExpiry,
        data
      );

      // Adjust win rate based on strategy type
      let winRateAdjustment = 1.0;
      switch (strategy) {
        case 'BULL_PUT_SPREAD':
        case 'BEAR_CALL_SPREAD':
          winRateAdjustment = 1.1; // 10% boost for defined risk spreads
          break;
        case 'IRON_CONDOR':
          winRateAdjustment = 1.15; // 15% boost for iron condors
          break;
        default:
          winRateAdjustment = 1.0;
      }

      // Adjust for volatility regime
      const volatilityRegime = VolatilityAnalysis.getVolatilityRegime(data.vix, data.ivPercentile);
      if (volatilityRegime === 'high') {
        winRateAdjustment *= 0.95; // Slightly reduce in high volatility
      } else if (volatilityRegime === 'low') {
        winRateAdjustment *= 1.05; // Slightly increase in low volatility
      }

      // Calculate final win rate
      const winRate = baseProbability * winRateAdjustment;

      // Cap between 0.1 and 0.9
      return Math.max(0.1, Math.min(0.9, winRate));
    }

    // Fallback to base win rate calculation if no options data
    let baseWinRate = 0.5;

    // Adjust based on market bias
    const marketBias = this.determineMarketBias(data);
    if (marketBias === 'BULLISH' && (strategy.includes('bull') || strategy.includes('put'))) {
      baseWinRate += 0.1;
    } else if (marketBias === 'BEARISH' && (strategy.includes('bear') || strategy.includes('call'))) {
      baseWinRate += 0.1;
    }

    // Adjust for volatility regime
    const volatilityRegime = VolatilityAnalysis.getVolatilityRegime(data.vix, data.ivPercentile);
    if (volatilityRegime === 'high') {
      baseWinRate += 0.05;
    } else if (volatilityRegime === 'low') {
      baseWinRate -= 0.05;
    }

    // Adjust for trend strength
    const adxInterpretation = this.interpretADX(data.adx);
    if (adxInterpretation.strength === 'STRONG' || adxInterpretation.strength === 'VERY_STRONG') {
      baseWinRate += 0.05;
    }

    return Math.min(1, baseWinRate);
  }

  /**
   * Calculate the cumulative normal distribution function (CDF)
   * This is used to convert z-scores to probabilities
   */
  private static calculateNormalCDF(z: number): number {
    // Constants for the approximation
    const p = 0.2316419;
    const b1 = 0.319381530;
    const b2 = -0.356563782;
    const b3 = 1.781477937;
    const b4 = -1.821255978;
    const b5 = 1.330274429;

    // Calculate the approximation
    const t = 1 / (1 + p * Math.abs(z));
    const erf = 1 - (((((b5 * t + b4) * t + b3) * t + b2) * t + b1) * t) * Math.exp(-z * z);
    
    return 0.5 * (1 + Math.sign(z) * erf);
  }
} 