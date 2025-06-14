import { OptionsService } from '../../../services/options-service';
import { ConfigService } from '../../../config/config';
import { Logger } from '../../../core/logger';

// Mock dependencies
jest.mock('../../../config/config');
jest.mock('../../../core/logger');

describe('OptionsService Cache', () => {
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

  describe('Cache Management', () => {
    it('should handle cache expiration', async () => {
      const targetDaysToExpiry = 25;
      const mockOptionsData = {
        expirations: [new Date(Date.now() + 25 * 24 * 60 * 60 * 1000)],
        underlyingPrice: 100,
        options: [{
          expirationDate: Math.floor((Date.now() + 25 * 24 * 60 * 60 * 1000) / 1000),
          hasMiniOptions: false,
          calls: [{ strike: { raw: 100 } }],
          puts: [{ strike: { raw: 100 } }]
        }]
      };

      jest.spyOn(OptionsService.prototype as any, 'fetchOptionsData')
        .mockResolvedValue(mockOptionsData);

      // First call should fetch data
      const result1 = await optionsService.getOptionsDataForDaysToExpiry(targetDaysToExpiry);
      expect(result1).toBeDefined();

      // Simulate cache expiration
      jest.advanceTimersByTime(61000); // Cache duration + 1 second

      // Second call should fetch new data
      const result2 = await optionsService.getOptionsDataForDaysToExpiry(targetDaysToExpiry);
      expect(result2).toBeDefined();
      expect(result2).not.toEqual(result1);
    });

    it('should handle disabled cache', async () => {
      mockConfig.getCacheConfig.mockReturnValue({ enabled: false, duration: 60000 });
      const targetDaysToExpiry = 25;
      const mockOptionsData1 = {
        expirations: [new Date(Date.now() + 25 * 24 * 60 * 60 * 1000)],
        underlyingPrice: 100,
        options: [{
          expirationDate: Math.floor((Date.now() + 25 * 24 * 60 * 60 * 1000) / 1000),
          hasMiniOptions: false,
          calls: [{ strike: { raw: 100 } }],
          puts: [{ strike: { raw: 100 } }]
        }]
      };

      const mockOptionsData2 = {
        expirations: [new Date(Date.now() + 25 * 24 * 60 * 60 * 1000)],
        underlyingPrice: 101, // Different price
        options: [{
          expirationDate: Math.floor((Date.now() + 25 * 24 * 60 * 60 * 1000) / 1000),
          hasMiniOptions: false,
          calls: [{ strike: { raw: 101 } }], // Different strike
          puts: [{ strike: { raw: 101 } }] // Different strike
        }]
      };

      const fetchSpy = jest.spyOn(OptionsService.prototype as any, 'fetchOptionsData')
        .mockResolvedValueOnce(mockOptionsData1)
        .mockResolvedValueOnce(mockOptionsData2);

      // Both calls should fetch data
      const result1 = await optionsService.getOptionsDataForDaysToExpiry(targetDaysToExpiry);
      const result2 = await optionsService.getOptionsDataForDaysToExpiry(targetDaysToExpiry);
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result2).not.toEqual(result1);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache edge cases', () => {
    it('should return null if cache is disabled', () => {
      mockConfig.getCacheConfig.mockReturnValue({ enabled: false, duration: 60000 });
      (optionsService as any).optionsDataCache['test'] = { data: { foo: 'bar' }, timestamp: Date.now() };
      const result = (optionsService as any).getCachedOptionsData('test');
      expect(result).toBeNull();
    });

    it('should return null if cache is expired', () => {
      mockConfig.getCacheConfig.mockReturnValue({ enabled: true, duration: 1 });
      (optionsService as any).optionsDataCache['test'] = { data: { foo: 'bar' }, timestamp: Date.now() - 10000 };
      const result = (optionsService as any).getCachedOptionsData('test');
      expect(result).toBeNull();
    });

    it('should not cache data when cache is disabled', () => {
      mockConfig.getCacheConfig.mockReturnValue({ enabled: false, duration: 60000 });
      (optionsService as any).cacheOptionsData('test', { foo: 'bar' });
      expect((optionsService as any).optionsDataCache['test']).toBeUndefined();
    });
  });

  describe('Cache logger coverage', () => {
    it('should log debug when using cached options data', () => {
      const debugSpy = jest.spyOn((optionsService as any).logger, 'debug');
      mockConfig.getCacheConfig.mockReturnValue({ enabled: true, duration: 60000 });
      (optionsService as any).optionsDataCache['test'] = { data: { foo: 'bar' }, timestamp: Date.now() };
      const result = (optionsService as any).getCachedOptionsData('test');
      expect(result).toEqual({ foo: 'bar' });
      expect(debugSpy).toHaveBeenCalledWith('Using cached options data', { key: 'test' });
    });

    it('should log debug when caching options data', () => {
      const debugSpy = jest.spyOn((optionsService as any).logger, 'debug');
      mockConfig.getCacheConfig.mockReturnValue({ enabled: true, duration: 60000 });
      (optionsService as any).cacheOptionsData('test', { foo: 'bar' });
      expect(debugSpy).toHaveBeenCalledWith('Cached options data', { key: 'test' });
    });
  });
}); 