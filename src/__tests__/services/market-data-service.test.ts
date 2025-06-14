import { MarketDataService } from '../../services/market-data-service';
import { MarketDataError } from '../../types/errors';
import { ConfigService } from '../../config/config';
import { Logger } from '../../core/logger';

// Mock dependencies
jest.mock('../../config/config');
jest.mock('../../core/logger');

// Mock fetch
global.fetch = jest.fn();

describe('MarketDataService', () => {
  let marketDataService: MarketDataService;
  let mockConfig: jest.Mocked<ConfigService>;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup mock config
    mockConfig = {
      getApiConfig: jest.fn().mockReturnValue({
        yahooFinanceApi: 'https://query1.finance.yahoo.com/v8/finance/chart/SPY',
        vixApi: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX',
        optionsApi: 'https://query1.finance.yahoo.com/v7/finance/options/SPY',
        requestInterval: 5000
      }),
      getTechnicalConfig: jest.fn().mockReturnValue({
        rsiPeriod: 14,
        macdFastPeriod: 12,
        macdSlowPeriod: 26,
        macdSignalPeriod: 9,
        smaPeriods: [50, 200]
      }),
      getCacheConfig: jest.fn().mockReturnValue({
        enabled: false,
        duration: 60000
      }),
      getMarketDataConfig: jest.fn().mockReturnValue({
        apiKey: 'test-key',
        baseUrl: 'https://api.test.com',
        symbols: ['SPY']
      })
    } as any;

    // Setup mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn()
    } as any;

    // Mock the static getInstance methods
    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfig);
    (Logger.getInstance as jest.Mock).mockReturnValue(mockLogger);

    marketDataService = new MarketDataService();
    (global.fetch as jest.Mock).mockClear();
  });

  describe('fetchCurrentMarketData', () => {
    it('should successfully fetch and process market data', async () => {
      // Provide at least 200 data points for technical indicators
      const close = Array.from({ length: 200 }, (_, i) => 100 + i);
      const high = close.map(v => v + 2);
      const low = close.map(v => v - 2);
      const volume = Array(200).fill(1000000);
      const mockSpyResponse = {
        chart: {
          result: [{
            timestamp: Array(200).fill(1622505600),
            indicators: {
              quote: [{ close, high, low, volume }]
            },
            meta: {
              regularMarketPrice: close[close.length - 1]
            }
          }]
        }
      };
      const mockVixResponse = {
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 20
            },
            indicators: { quote: [{ close, high, low, volume }] },
            timestamp: Array(200).fill(1622505600)
          }]
        }
      };

      // Mock fetch with logging and handle third call for historical VIX data
      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        console.log(`Fetch call #${(global.fetch as jest.Mock).mock.calls.length}:`);
        console.log('URL:', url);
        console.log('Options:', JSON.stringify(options, null, 2));

        const callCount = (global.fetch as jest.Mock).mock.calls.length;
        if (callCount === 1) {
          // First call: SPY data
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSpyResponse) });
        } else if (callCount === 2) {
          // Second call: VIX current price
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockVixResponse) });
        } else if (callCount === 3) {
          // Third call: VIX historical data (investigated from logs)
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockVixResponse) });
        } else {
          throw new Error('Unexpected fetch call in test');
        }
      });

      // Only mock optionsService, not vixService, so VIX fetch is called
      const mockOptionsService = {
        getOptionsDataForDaysToExpiry: jest.fn().mockResolvedValue({
          date: new Date(),
          strikes: { call: {}, put: {} }
        })
      };
      (marketDataService as any).optionsService = mockOptionsService;

      const result = await marketDataService.fetchCurrentMarketData();

      expect(result).toBeDefined();
      expect(result.price).toBe(close[close.length - 1]);
      expect(result.sma50).toBeDefined();
      expect(result.sma200).toBeDefined();
      expect(result.macd).toBeDefined();
      expect(result.rsi).toBeDefined();
      expect(result.adx).toBeDefined();
      expect(result.plusDI).toBeDefined();
      expect(result.minusDI).toBeDefined();
      expect(result.vix).toBe(20);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw MarketDataError when API request fails', async () => {
      // Mock failed API response with logging
      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        console.log(`Fetch call #${(global.fetch as jest.Mock).mock.calls.length}:`);
        console.log('URL:', url);
        console.log('Options:', JSON.stringify(options, null, 2));
        return Promise.resolve({
          ok: false,
          status: 500
        });
      });

      await expect(marketDataService.fetchCurrentMarketData())
        .rejects
        .toThrow(MarketDataError);
    });

    it('should handle network errors', async () => {
      // Mock network error with logging
      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        console.log(`Fetch call #${(global.fetch as jest.Mock).mock.calls.length}:`);
        console.log('URL:', url);
        console.log('Options:', JSON.stringify(options, null, 2));
        return Promise.reject(new Error('Network error'));
      });

      await expect(marketDataService.fetchCurrentMarketData())
        .rejects
        .toThrow(MarketDataError);
    });

    it('should calculate technical indicators correctly', async () => {
      // Provide at least 200 data points for technical indicators
      const close = Array.from({ length: 200 }, (_, i) => 100 + i);
      const high = close.map(v => v + 2);
      const low = close.map(v => v - 2);
      const volume = Array(200).fill(1000000);
      const mockSpyResponse = {
        chart: {
          result: [{
            timestamp: Array(200).fill(1622505600),
            indicators: {
              quote: [{ close, high, low, volume }]
            },
            meta: {
              regularMarketPrice: close[close.length - 1]
            }
          }]
        }
      };
      const mockVixResponse = {
        chart: {
          result: [{
            meta: {
              regularMarketPrice: 20
            },
            indicators: { quote: [{ close, high, low, volume }] },
            timestamp: Array(200).fill(1622505600)
          }]
        }
      };

      // Mock fetch with logging and handle third call for historical VIX data
      (global.fetch as jest.Mock).mockImplementation((url: string, options?: any) => {
        console.log(`Fetch call #${(global.fetch as jest.Mock).mock.calls.length}:`);
        console.log('URL:', url);
        console.log('Options:', JSON.stringify(options, null, 2));

        const callCount = (global.fetch as jest.Mock).mock.calls.length;
        if (callCount === 1) {
          // First call: SPY data
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockSpyResponse) });
        } else if (callCount === 2) {
          // Second call: VIX current price
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockVixResponse) });
        } else if (callCount === 3) {
          // Third call: VIX historical data (investigated from logs)
          return Promise.resolve({ ok: true, json: () => Promise.resolve(mockVixResponse) });
        } else {
          throw new Error('Unexpected fetch call in test');
        }
      });

      // Only mock optionsService, not vixService, so VIX fetch is called
      const mockOptionsService = {
        getOptionsDataForDaysToExpiry: jest.fn().mockResolvedValue({
          date: new Date(),
          strikes: { call: {}, put: {} }
        })
      };
      (marketDataService as any).optionsService = mockOptionsService;

      const result = await marketDataService.fetchCurrentMarketData();

      expect(result.sma50).toBeDefined();
      expect(result.sma200).toBeDefined();
      expect(result.macd).toBeDefined();
      expect(result.rsi).toBeDefined();
      expect(result.adx).toBeDefined();
      expect(result.plusDI).toBeDefined();
      expect(result.minusDI).toBeDefined();
      expect(result.vix).toBe(20);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('calculateDaysBetween', () => {
    it('should calculate days between dates correctly', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-10');
      
      const result = (marketDataService as any).calculateDaysBetween(startDate, endDate);
      
      expect(result).toBe(9);
    });

    it('should handle same day dates', () => {
      const date = new Date('2024-01-01');
      
      const result = (marketDataService as any).calculateDaysBetween(date, date);
      
      expect(result).toBe(0);
    });
  });
}); 