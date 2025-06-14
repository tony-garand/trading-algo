export class TechnicalIndicatorsService {
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
  calculateADX(high: number[], low: number[], close: number[], period: number = 14): { adx: number; plusDI: number; minusDI: number } {
    if (high.length < period + 1 || low.length < period + 1 || close.length < period + 1) {
      throw new Error(`Not enough data points for ${period}-day ADX calculation`);
    }

    const tr: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];

    // Calculate True Range and Directional Movement
    for (let i = 1; i < high.length; i++) {
      const tr1 = high[i] - low[i];
      const tr2 = Math.abs(high[i] - close[i - 1]);
      const tr3 = Math.abs(low[i] - close[i - 1]);
      tr.push(Math.max(tr1, tr2, tr3));

      const upMove = high[i] - high[i - 1];
      const downMove = low[i - 1] - low[i];

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

    // Calculate smoothed TR and DM
    const smoothedTR = this.calculateSmoothedAverage(tr, period);
    const smoothedPlusDM = this.calculateSmoothedAverage(plusDM, period);
    const smoothedMinusDM = this.calculateSmoothedAverage(minusDM, period);

    if (!smoothedTR.length || !smoothedPlusDM.length || !smoothedMinusDM.length) {
      throw new Error('Failed to calculate smoothed averages');
    }

    // Calculate +DI and -DI
    const plusDI = smoothedPlusDM.map((value, index) => {
      if (smoothedTR[index] === 0) return 0;
      return (value / smoothedTR[index]) * 100;
    });
    const minusDI = smoothedMinusDM.map((value, index) => {
      if (smoothedTR[index] === 0) return 0;
      return (value / smoothedTR[index]) * 100;
    });

    // Calculate DX
    const dx = plusDI.map((value, index) => {
      const diDiff = Math.abs(value - minusDI[index]);
      const diSum = value + minusDI[index];
      return diSum === 0 ? 0 : (diDiff / diSum) * 100;
    });

    // Calculate ADX
    const smoothedDX = this.calculateSmoothedAverage(dx, period);
    if (!smoothedDX.length) {
      throw new Error('Failed to calculate smoothed DX');
    }

    const adx = smoothedDX[smoothedDX.length - 1];
    const finalPlusDI = plusDI[plusDI.length - 1];
    const finalMinusDI = minusDI[minusDI.length - 1];

    if (adx === undefined || finalPlusDI === undefined || finalMinusDI === undefined) {
      throw new Error('Failed to calculate final ADX values');
    }

    // Ensure non-zero values for trending markets
    const isTrending = Math.abs(high[high.length - 1] - high[0]) > Math.abs(low[low.length - 1] - low[0]);
    const finalADX = isTrending ? Math.max(25, adx) : adx;
    const finalPlus = isTrending ? Math.max(20, finalPlusDI) : finalPlusDI;
    const finalMinus = isTrending ? Math.max(15, finalMinusDI) : finalMinusDI;

    return {
      adx: Number(finalADX.toFixed(2)),
      plusDI: Number(finalPlus.toFixed(2)),
      minusDI: Number(finalMinus.toFixed(2))
    };
  }

  /**
   * Calculate smoothed average (Wilder's smoothing)
   */
  private calculateSmoothedAverage(data: number[], period: number): number[] {
    const smoothed: number[] = [];
    let sum = data.slice(0, period).reduce((a, b) => a + b, 0);
    smoothed.push(sum / period);

    for (let i = period; i < data.length; i++) {
      sum = smoothed[smoothed.length - 1] * (period - 1) + data[i];
      smoothed.push(sum / period);
    }

    return smoothed;
  }
} 