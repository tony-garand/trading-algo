export interface BacktestResult {
  startDate: Date;
  endDate: Date;
  initialBalance: number;
  finalBalance: number;
  totalReturn: number;
  trades: TradeResult[];
  metrics: {
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
  };
}

export interface TradeResult {
  entryDate: Date;
  exitDate: Date;
  strategy: string;
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  return: number;
  maxDrawdown: number;
  holdingPeriod: number;
} 