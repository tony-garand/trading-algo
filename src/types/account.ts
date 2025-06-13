export interface AccountInfo {
  type: string;
  balance: number;
  maxRiskPerTrade: number;
  maxOpenPositions: number;
  currentDrawdown: number;
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'call' | 'put';
  strike: number;
  expiration: Date;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  entryDate: Date;
  exitDate?: Date;
  pnl?: number;
  status: 'open' | 'closed';
  strategy: string;
  riskMetrics: {
    maxLoss: number;
    maxProfit: number;
    probabilityOfProfit: number;
  };
} 