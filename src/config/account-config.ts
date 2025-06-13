import { AccountInfo } from '../types/account';

export const accountConfigs: { [key: string]: AccountInfo } = {
  small: {
    type: 'small',
    balance: 10000,
    maxRiskPerTrade: 0.10, // 10% max
    maxOpenPositions: 2,
    currentDrawdown: 0
  },
  
  medium: {
    type: 'medium',
    balance: 40000,
    maxRiskPerTrade: 0.12, // 12% max
    maxOpenPositions: 3,
    currentDrawdown: 0
  },
  
  large: {
    type: 'large',
    balance: 100000,
    maxRiskPerTrade: 0.15, // 15% max
    maxOpenPositions: 4,
    currentDrawdown: 0
  },

  stressed: {
    type: 'stressed',
    balance: 32000, // Down from 40k
    maxRiskPerTrade: 0.08, // Reduced max risk
    maxOpenPositions: 2,
    currentDrawdown: 20 // 20% drawdown
  }
}; 