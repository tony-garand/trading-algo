export interface TechnicalSignal {
  type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;
  indicators: {
    [key: string]: number;
  };
}

export interface StrategyParameters {
  strategy: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  buyStrike?: number;
  sellStrike?: number;
  buyOptionType?: 'PUT' | 'CALL';
  sellOptionType?: 'PUT' | 'CALL';
  expirationDate?: Date;
  maxLoss?: number;
  maxProfit?: number;
  probabilityOfProfit?: number;
}

export interface StrategyRecommendation {
  timestamp: Date;
  marketConditions: {
    trend: string;
    volatility: string;
    sentiment: string;
  };
  technicalSignals: TechnicalSignal[];
  strategyParameters: StrategyParameters;
  riskMetrics: {
    maxLoss: number;
    maxProfit: number;
    probabilityOfProfit: number;
    riskRewardRatio: number;
  };
  confidence: number;
} 