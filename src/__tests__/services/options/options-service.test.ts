import { OptionsService } from '../../../services/options-service';
import { ConfigService } from '../../../config/config';
import { Logger } from '../../../core/logger';

// Mock dependencies
jest.mock('../../../config/config');
jest.mock('../../../core/logger');

describe('OptionsService', () => {
  let optionsService: OptionsService;
  let mockConfig: jest.Mocked<ConfigService>;
  let mockLoggerInstance: jest.Mocked<Logger>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup timer mocks
    jest.useFakeTimers();

    // Setup mock config
    mockConfig = {
      getCacheConfig: jest.fn().mockReturnValue({
        enabled: true,
        duration: 60000
      }),
      getOptionsConfig: jest.fn().mockReturnValue({
        defaultDaysToExpiry: 30,
        toleranceDays: 5
      })
    } as any;

    // Setup mock logger
    mockLoggerInstance = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn()
    } as any;

    // Mock the static getInstance method
    (Logger.getInstance as jest.Mock).mockReturnValue(mockLoggerInstance);
    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfig);

    // Create service instance
    optionsService = new OptionsService();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('getOptionsDataForDaysToExpiry', () => {
    it('should return options data for target DTE', async () => {
      const targetDaysToExpiry = 25;
      const mockOptionsData = {
        expirations: [
          new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        ],
        underlyingPrice: 100,
        options: [{
          expirationDate: Math.floor((Date.now() + 25 * 24 * 60 * 60 * 1000) / 1000),
          hasMiniOptions: false,
          calls: [{
            percentChange: { raw: 0, fmt: '0%' },
            openInterest: { raw: 500, fmt: '500', longFmt: '500' },
            strike: { raw: 100, fmt: '100' },
            change: { raw: 0, fmt: '0' },
            inTheMoney: false,
            impliedVolatility: { raw: 0.3, fmt: '30%' },
            volume: { raw: 1000, fmt: '1,000', longFmt: '1,000' },
            ask: { raw: 2.6, fmt: '2.60' },
            contractSymbol: 'SPY240616C00100000',
            lastTradeDate: { raw: Date.now() / 1000, fmt: '', longFmt: '' },
            currency: 'USD',
            expiration: { raw: Date.now() / 1000 + 25 * 24 * 60 * 60, fmt: '', longFmt: '' },
            contractSize: 'REGULAR',
            bid: { raw: 2.4, fmt: '2.40' },
            lastPrice: { raw: 2.5, fmt: '2.50' }
          }],
          puts: [{
            percentChange: { raw: 0, fmt: '0%' },
            openInterest: { raw: 500, fmt: '500', longFmt: '500' },
            strike: { raw: 100, fmt: '100' },
            change: { raw: 0, fmt: '0' },
            inTheMoney: false,
            impliedVolatility: { raw: 0.3, fmt: '30%' },
            volume: { raw: 1000, fmt: '1,000', longFmt: '1,000' },
            ask: { raw: 2.6, fmt: '2.60' },
            contractSymbol: 'SPY240616P00100000',
            lastTradeDate: { raw: Date.now() / 1000, fmt: '', longFmt: '' },
            currency: 'USD',
            expiration: { raw: Date.now() / 1000 + 25 * 24 * 60 * 60, fmt: '', longFmt: '' },
            contractSize: 'REGULAR',
            bid: { raw: 2.4, fmt: '2.40' },
            lastPrice: { raw: 2.5, fmt: '2.50' }
          }]
        }]
      };

      jest.spyOn(OptionsService.prototype as any, 'fetchOptionsData')
        .mockResolvedValue(mockOptionsData);

      const result = await optionsService.getOptionsDataForDaysToExpiry(targetDaysToExpiry);

      expect(result).toBeDefined();
      expect(result.date).toBeInstanceOf(Date);
      expect(result.underlyingPrice).toBe(100);
      expect(result.strikes).toBeDefined();
      expect(result.strikes.call).toBeDefined();
      expect(result.strikes.put).toBeDefined();
    });

    it('should throw error when no expiration date found within tolerance', async () => {
      const targetDaysToExpiry = 1000; // Very far future date
      const toleranceDays = 5;

      const mockOptionsData = {
        expirations: [
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
        ],
        underlyingPrice: 100,
        options: []
      };

      jest.spyOn(OptionsService.prototype as any, 'fetchOptionsData')
        .mockResolvedValue(mockOptionsData);

      await expect(optionsService.getOptionsDataForDaysToExpiry(targetDaysToExpiry, toleranceDays))
        .rejects.toThrow(`No expiration date found within ${toleranceDays} days of target ${targetDaysToExpiry} days`);
    });
  });
}); 