export interface MarketData {
  price: number;
  sma50: number;
  sma200: number;
  macd: number;
  rsi: number;
  vix: number;
  ivPercentile: number;
  adx: number;
  plusDI: number;  // Positive Directional Indicator
  minusDI: number; // Negative Directional Indicator
  volume: number;
  date: Date;
  optionsData?: {
    expiryDate: Date;
    strikes: number[];
    daysToExpiration: number;
    options: Array<{
      option: string;
      strike: number;
      type: 'call' | 'put';
      bid: number;
      ask: number;
      bid_size: number;
      ask_size: number;
      last_trade_price: number;
      last_trade_time: string;
      volume: number;
      open_interest: number;
      delta: number;
      gamma: number;
      vega: number;
      theta: number;
      rho: number;
      theo: number;
    }>;
  };
  // New sentiment indicators
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
  sentiment?: {
    marketBreadth: number;
    sectorPerformance: number;
  };
} 