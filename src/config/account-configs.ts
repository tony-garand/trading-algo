export interface AccountConfig {
  type: 'small' | 'medium' | 'large' | 'stressed';
  balance: number;
  maxRiskPerTrade: number;
  maxOpenPositions: number;
  positionSizeRange: {
    min: number;
    max: number;
  };
}

export const ACCOUNT_CONFIGS: Record<string, AccountConfig> = {
  small: {
    type: 'small',
    balance: 10000,
    maxRiskPerTrade: 0.10,
    maxOpenPositions: 2,
    positionSizeRange: {
      min: 0.04,
      max: 0.10
    }
  },
  medium: {
    type: 'medium',
    balance: 40000,
    maxRiskPerTrade: 0.12,
    maxOpenPositions: 3,
    positionSizeRange: {
      min: 0.05,
      max: 0.12
    }
  },
  large: {
    type: 'large',
    balance: 100000,
    maxRiskPerTrade: 0.15,
    maxOpenPositions: 4,
    positionSizeRange: {
      min: 0.06,
      max: 0.15
    }
  },
  stressed: {
    type: 'stressed',
    balance: 0, // Will be set dynamically
    maxRiskPerTrade: 0.05,
    maxOpenPositions: 1,
    positionSizeRange: {
      min: 0.02,
      max: 0.05
    }
  }
}; 