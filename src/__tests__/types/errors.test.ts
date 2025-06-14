import {
  TradingBotError,
  MarketDataError,
  StrategyError,
  BacktestError,
  ValidationError
} from '../../types/errors';

describe('Error Types', () => {
  describe('TradingBotError', () => {
    it('should create a TradingBotError with correct name and message', () => {
      const error = new TradingBotError('Test error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TradingBotError);
      expect(error.name).toBe('TradingBotError');
      expect(error.message).toBe('Test error');
    });
  });

  describe('MarketDataError', () => {
    it('should create a MarketDataError with correct name and message', () => {
      const error = new MarketDataError('Market data error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TradingBotError);
      expect(error).toBeInstanceOf(MarketDataError);
      expect(error.name).toBe('MarketDataError');
      expect(error.message).toBe('Market data error');
    });
  });

  describe('StrategyError', () => {
    it('should create a StrategyError with correct name and message', () => {
      const error = new StrategyError('Strategy error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TradingBotError);
      expect(error).toBeInstanceOf(StrategyError);
      expect(error.name).toBe('StrategyError');
      expect(error.message).toBe('Strategy error');
    });
  });

  describe('BacktestError', () => {
    it('should create a BacktestError with correct name and message', () => {
      const error = new BacktestError('Backtest error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TradingBotError);
      expect(error).toBeInstanceOf(BacktestError);
      expect(error.name).toBe('BacktestError');
      expect(error.message).toBe('Backtest error');
    });
  });

  describe('ValidationError', () => {
    it('should create a ValidationError with correct name and message', () => {
      const error = new ValidationError('Validation error');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(TradingBotError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Validation error');
    });
  });
}); 