import { Logger } from '../core/logger';

export class TechnicalIndicatorsService {
  private logger: Logger;

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Calculate Simple Moving Average
   */
  calculateSMA(data: number[], period: number): number[] {
    if (data.length < period) {
      throw new Error(`Not enough data points for ${period}-day SMA calculation`);
    }

    const sma: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  /**
   * Calculate MACD
   */
  calculateMACD(data: number[]): number[] {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    return ema12.map((value, index) => value - ema26[index]);
  }

  /**
   * Calculate EMA
   */
  calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema: number[] = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      ema.push(data[i] * k + ema[i - 1] * (1 - k));
    }
    
    return ema;
  }

  /**
   * Calculate RSI
   */
  calculateRSI(data: number[], period: number = 14): number[] {
    const rsi: number[] = [];
    const changes = data.slice(1).map((value, index) => value - data[index]);
    
    for (let i = period; i < changes.length; i++) {
      const gains = changes.slice(i - period, i).filter(change => change > 0).reduce((a, b) => a + b, 0);
      const losses = Math.abs(changes.slice(i - period, i).filter(change => change < 0).reduce((a, b) => a + b, 0));
      
      const rs = gains / losses;
      rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
  }

  /**
   * Calculate ADX
   */
  calculateADX(high: number[], low: number[], close: number[], period: number = 14): number {
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

    const tr14 = this.calculateEMA(tr, period);
    const plusDM14 = this.calculateEMA(plusDM, period);
    const minusDM14 = this.calculateEMA(minusDM, period);

    const plusDI = plusDM14.map((value, index) => (value / tr14[index]) * 100);
    const minusDI = minusDM14.map((value, index) => (value / tr14[index]) * 100);

    const dx = plusDI.map((value, index) => 
      Math.abs((value - minusDI[index]) / (value + minusDI[index])) * 100
    );

    return this.calculateEMA(dx, period)[dx.length - 1];
  }
} 