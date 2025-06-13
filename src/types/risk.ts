export interface RiskMetrics {
  maxLoss: number;
  maxProfit: number;
  probabilityOfProfit: number;
  riskRewardRatio: number;
  positionSize: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  beta: number;
  correlation: number;
}

export interface RiskParameters {
  maxRiskPerTrade: number;
  maxOpenPositions: number;
  maxDrawdown: number;
  positionSizeRange: {
    min: number;
    max: number;
  };
  volatilityAdjustment: number;
  correlationThreshold: number;
} 