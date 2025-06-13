export class VolatilityAnalysis {
  static readonly VIX_THRESHOLDS = {
    LOW: 15,
    MEDIUM: 20,
    HIGH: 25
  };

  static calculateIVPercentile(currentIV: number, historicalIVs: number[]): number {
    if (historicalIVs.length === 0) return 50;
    
    const sortedIVs = [...historicalIVs].sort((a, b) => a - b);
    const position = sortedIVs.findIndex(iv => iv >= currentIV);
    
    if (position === -1) return 100;
    return (position / sortedIVs.length) * 100;
  }

  static isHighVolatility(vix: number): boolean {
    return vix > 20;
  }

  static getVolatilityRegime(vix: number, ivPercentile: number): 'low' | 'medium' | 'high' {
    if (vix > 25 || ivPercentile > 70) return 'high';
    if (vix < 15 || ivPercentile < 30) return 'low';
    return 'medium';
  }

  static calculateVolatilityAdjustment(vix: number, ivPercentile: number): number {
    const baseAdjustment = 1.0;
    const vixAdjustment = Math.min(vix / 20, 1.5);
    const percentileAdjustment = ivPercentile / 50;
    
    return baseAdjustment * vixAdjustment * percentileAdjustment;
  }

  /**
   * Determine IV environment based on VIX
   */
  static determineIVEnvironment(vix: number): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (vix < VolatilityAnalysis.VIX_THRESHOLDS.LOW) return 'LOW';
    if (vix > VolatilityAnalysis.VIX_THRESHOLDS.HIGH) return 'HIGH';
    return 'MEDIUM';
  }

  /**
   * Calculate VIX adjustment factor for strategy parameters
   */
  static calculateVixAdjustment(vix: number): number {
    // VIX adjustment factor
    // VIX < 15: 0.8 (tighter spreads in low vol)
    // VIX 15-30: 1.0 (normal spreads)
    // VIX > 30: 1.2 (wider spreads in high vol)
    if (vix < 15) return 0.8;
    if (vix > 30) return 1.2;
    return 1.0;
  }

  /**
   * Calculate IV percentile adjustment factor for strategy parameters
   */
  static calculateIVPercentileAdjustment(ivPercentile: number): number {
    // IV percentile adjustment factor
    // IV < 30%: 0.8 (tighter spreads in low IV)
    // IV 30-70%: 1.0 (normal spreads)
    // IV > 70%: 1.2 (wider spreads in high IV)
    if (ivPercentile < 30) return 0.8;
    if (ivPercentile > 70) return 1.2;
    return 1.0;
  }
} 