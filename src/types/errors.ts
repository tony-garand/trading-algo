export class TradingBotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TradingBotError';
  }
}

export class MarketDataError extends TradingBotError {
  constructor(message: string) {
    super(message);
    this.name = 'MarketDataError';
  }
}

export class StrategyError extends TradingBotError {
  constructor(message: string) {
    super(message);
    this.name = 'StrategyError';
  }
}

export class BacktestError extends TradingBotError {
  constructor(message: string) {
    super(message);
    this.name = 'BacktestError';
  }
}

export class ValidationError extends TradingBotError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
} 