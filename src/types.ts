export interface MarketData {
  price: number;
  sma50: number;
  sma200: number;
  macd: number;
  rsi: number;
  vix: number;
  ivPercentile: number;
  adx: number;
  volume?: number;
  date: Date;
  // New sentiment indicators
  putCallRatio?: number;
  marketBreadth?: {
    advancing: number;
    declining: number;
    unchanged: number;
  };
  sectorPerformance?: {
    [sector: string]: number;
  };
  marketCap?: number;
  earningsYield?: number;
  dividendYield?: number;
} 