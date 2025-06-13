import { MarketData } from '../types/types';

export class TechnicalAnalysis {
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
} 