import { MarketData } from '../types/types';

export class VolatilityAnalysis {
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
} 