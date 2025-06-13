export interface OptionsData {
  expiryDate: Date;
  strikes: number[];
  daysToExpiration: number;
  options: OptionQuote[];
}

export interface OptionQuote {
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
}

export interface YahooOptionQuote {
  contractSymbol: string;
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  lastTradeDate: string;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  theoreticalPrice: number;
}

export interface YahooUnderlyingQuote {
  symbol: string;
  quoteType: string;
  typeDisp: string;
  regularMarketPrice: number;
  regularMarketVolume: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
}

export interface YahooOptionsForExpiration {
  expirationDate: number;
  calls: YahooOptionQuote[];
  puts: YahooOptionQuote[];
}

export interface YahooOptionChainResult {
  result: {
    underlyingSymbol: string;
    expirationDates: number[];
    strikes: number[];
    options: YahooOptionsForExpiration[];
  }[];
  error: null;
}

export interface ProcessedOptions {
  calls: OptionQuote[];
  puts: OptionQuote[];
  expiryDate: Date;
  daysToExpiration: number;
} 