import { OptionsService, YahooOptionsForExpiration, YahooOptionQuote } from '../../../services/options-service';
import { ConfigService } from '../../../config/config';
import { Logger } from '../../../core/logger';

// Mock dependencies
jest.mock('../../../config/config');
jest.mock('../../../core/logger');

describe('OptionsService Data Processing', () => {
  let optionsService: OptionsService;
  let mockConfig: jest.Mocked<ConfigService>;
  let mockLoggerInstance: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockConfig = {
      getCacheConfig: jest.fn().mockReturnValue({
        enabled: true,
        duration: 60000
      })
    } as any;

    mockLoggerInstance = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn()
    } as any;

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLoggerInstance);
    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfig);

    optionsService = new OptionsService();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('processOptions', () => {
    it('should handle empty options array', () => {
      const mockYahooOptions: YahooOptionsForExpiration[] = [];
      expect(() => (optionsService as any).processOptions(mockYahooOptions))
        .toThrow('Invalid options data format');
    });

    it('should handle invalid option objects', () => {
      const mockYahooOptions: YahooOptionsForExpiration[] = [{
        expirationDate: 1234567890,
        hasMiniOptions: false,
        calls: [{} as YahooOptionQuote],
        puts: [{} as YahooOptionQuote]
      }];
      expect(() => (optionsService as any).processOptions(mockYahooOptions))
        .toThrow('No valid options data found after processing');
    });

    it('should handle put-call ratio edge cases', () => {
      const mockYahooOptions: YahooOptionsForExpiration[] = [{
        expirationDate: 1234567890,
        hasMiniOptions: false,
        calls: [{
          strike: { raw: 100, fmt: '100.00' },
          lastPrice: { raw: 1.5, fmt: '1.50' },
          bid: { raw: 1.4, fmt: '1.40' },
          ask: { raw: 1.6, fmt: '1.60' },
          volume: { raw: 0, fmt: '0', longFmt: '0' },
          openInterest: { raw: 200, fmt: '200', longFmt: '200' },
          impliedVolatility: { raw: 0.3, fmt: '30%' },
          delta: 0,
          gamma: 0,
          theta: 0,
          vega: 0
        }],
        puts: [{
          strike: { raw: 100, fmt: '100.00' },
          lastPrice: { raw: 1.5, fmt: '1.50' },
          bid: { raw: 1.4, fmt: '1.40' },
          ask: { raw: 1.6, fmt: '1.60' },
          volume: { raw: 0, fmt: '0', longFmt: '0' },
          openInterest: { raw: 200, fmt: '200', longFmt: '200' },
          impliedVolatility: { raw: 0.3, fmt: '30%' },
          delta: 0,
          gamma: 0,
          theta: 0,
          vega: 0
        }]
      }];

      const result = (optionsService as any).processOptions(mockYahooOptions);
      expect(result.call[100]).toBeDefined();
      expect(result.put[100]).toBeDefined();
      expect(result.call[100].delta).toBe(0);
      expect(result.call[100].gamma).toBe(0);
      expect(result.call[100].theta).toBe(0);
      expect(result.call[100].vega).toBe(0);
    });

    it('should handle only puts having volume', () => {
      const mockYahooOptions: YahooOptionsForExpiration[] = [{
        expirationDate: 1234567890,
        hasMiniOptions: false,
        calls: [{
          strike: { raw: 100, fmt: '100.00' },
          lastPrice: { raw: 1.5, fmt: '1.50' },
          bid: { raw: 1.4, fmt: '1.40' },
          ask: { raw: 1.6, fmt: '1.60' },
          volume: { raw: 0, fmt: '0', longFmt: '0' },
          openInterest: { raw: 200, fmt: '200', longFmt: '200' },
          impliedVolatility: { raw: 0.3, fmt: '30%' },
          delta: 0,
          gamma: 0,
          theta: 0,
          vega: 0
        }],
        puts: [{
          strike: { raw: 100, fmt: '100.00' },
          lastPrice: { raw: 1.5, fmt: '1.50' },
          bid: { raw: 1.4, fmt: '1.40' },
          ask: { raw: 1.6, fmt: '1.60' },
          volume: { raw: 100, fmt: '100', longFmt: '100' },
          openInterest: { raw: 200, fmt: '200', longFmt: '200' },
          impliedVolatility: { raw: 0.3, fmt: '30%' },
          delta: 0,
          gamma: 0,
          theta: 0,
          vega: 0
        }]
      }];

      const result = (optionsService as any).processOptions(mockYahooOptions);
      expect(result.call[100]).toBeDefined();
      expect(result.put[100]).toBeDefined();
      expect(result.call[100].delta).toBe(0);
      expect(result.call[100].gamma).toBe(0);
      expect(result.call[100].theta).toBe(0);
      expect(result.call[100].vega).toBe(0);
    });

    it('should handle no options data', () => {
      const mockYahooOptions: YahooOptionsForExpiration[] = [{
        expirationDate: 1234567890,
        hasMiniOptions: false,
        calls: [],
        puts: []
      }];

      expect(() => (optionsService as any).processOptions(mockYahooOptions))
        .toThrow('No valid options data found after processing');
    });
  });
}); 