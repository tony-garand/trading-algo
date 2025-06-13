import { MarketData } from './types';

export interface RiskMetrics {
  maxPositionSize: number;
  suggestedStopLoss: number;
  riskRewardRatio: number;
  maxDrawdown: number;
  volatilityAdjustment: number;
  correlationRisk: number;
  maxRisk: number;
  stopLoss: number;
  profitTarget: number;
}

export class RiskManager {
  /**
   * Calculate risk metrics for a given market condition
   */
  static calculateRiskMetrics(marketData: MarketData, accountBalance: number): RiskMetrics {
    const volatilityAdjustment = this.calculateVolatilityAdjustment(marketData);
    const correlationRisk = this.calculateCorrelationRisk(marketData);
    
    // Base position size on account balance and volatility
    const maxPositionSize = accountBalance * 0.08 * volatilityAdjustment;
    
    // Calculate stop loss based on ATR or recent volatility
    const suggestedStopLoss = this.calculateStopLoss(marketData);
    
    // Calculate risk/reward ratio based on market conditions
    const riskRewardRatio = this.calculateRiskRewardRatio(marketData);
    
    // Calculate maximum drawdown based on historical volatility
    const maxDrawdown = this.calculateMaxDrawdown(marketData);

    // Calculate max risk and profit target
    const maxRisk = maxPositionSize;
    const stopLoss = suggestedStopLoss;
    const profitTarget = marketData.price + (marketData.price - suggestedStopLoss) * riskRewardRatio;

    return {
      maxPositionSize,
      suggestedStopLoss,
      riskRewardRatio,
      maxDrawdown,
      volatilityAdjustment,
      correlationRisk,
      maxRisk,
      stopLoss,
      profitTarget
    };
  }

  /**
   * Calculate volatility adjustment factor
   */
  private static calculateVolatilityAdjustment(marketData: MarketData): number {
    // Adjust position size based on VIX
    const vixAdjustment = Math.max(0.5, Math.min(1.5, 20 / marketData.vix));
    
    // Adjust for market breadth
    const breadthAdjustment = marketData.marketBreadth 
      ? marketData.marketBreadth.advancing / (marketData.marketBreadth.advancing + marketData.marketBreadth.declining)
      : 1;
    
    return vixAdjustment * breadthAdjustment;
  }

  /**
   * Calculate correlation risk
   */
  private static calculateCorrelationRisk(marketData: MarketData): number {
    // Higher correlation risk when market is trending strongly
    const trendStrength = Math.abs(marketData.price - marketData.sma50) / marketData.sma50;
    const volatilityFactor = marketData.vix / 20; // Normalize VIX
    
    return Math.min(1, trendStrength * volatilityFactor);
  }

  /**
   * Calculate suggested stop loss
   */
  private static calculateStopLoss(marketData: MarketData): number {
    // Use ATR or recent volatility to set stop loss
    const volatility = marketData.vix / 100;
    const atr = marketData.price * volatility;
    
    return marketData.price - (atr * 2); // 2 ATR stop loss
  }

  /**
   * Calculate risk/reward ratio
   */
  private static calculateRiskRewardRatio(marketData: MarketData): number {
    // Base R/R on market conditions
    const baseRatio = 2.0;
    
    // Adjust for volatility
    const volatilityAdjustment = 20 / marketData.vix;
    
    // Adjust for trend strength
    const trendAdjustment = marketData.adx ? marketData.adx / 25 : 1;
    
    return baseRatio * volatilityAdjustment * trendAdjustment;
  }

  /**
   * Calculate maximum drawdown
   */
  private static calculateMaxDrawdown(marketData: MarketData): number {
    // Estimate max drawdown based on VIX and market conditions
    const baseDrawdown = marketData.vix / 20; // Normalize VIX
    const trendFactor = marketData.adx ? marketData.adx / 25 : 1;
    
    return Math.min(0.25, baseDrawdown * trendFactor); // Cap at 25%
  }

  /**
   * Validate position size against risk limits
   */
  static validatePositionSize(positionSize: number, riskMetrics: RiskMetrics): boolean {
    return positionSize <= riskMetrics.maxPositionSize;
  }

  /**
   * Get risk-adjusted position size
   */
  static getRiskAdjustedPositionSize(desiredSize: number, riskMetrics: RiskMetrics): number {
    return Math.min(desiredSize, riskMetrics.maxPositionSize);
  }
} 