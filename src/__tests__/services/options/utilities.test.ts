import { OptionsService, YahooOptionsForExpiration, YahooOptionQuote } from '../../../services/options-service';
import { ConfigService } from '../../../config/config';
import { Logger } from '../../../core/logger';

// Mock dependencies
jest.mock('../../../config/config');
jest.mock('../../../core/logger');

describe('OptionsService Utilities', () => {
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

  describe('calculateDaysBetween', () => {
    it('should calculate days between two dates', () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-10');
      const days = optionsService['calculateDaysBetween'](startDate, endDate);
      expect(days).toBe(9);
    });

    it('should handle same day', () => {
      const date = new Date('2024-01-01');
      const days = optionsService['calculateDaysBetween'](date, date);
      expect(days).toBe(0);
    });

    it('should handle dates in reverse order', () => {
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-01-01');
      const days = optionsService['calculateDaysBetween'](startDate, endDate);
      expect(days).toBe(9);
    });
  });

  describe('extractExpirationDates', () => {
    it('should extract expiration dates from options data', () => {
      const mockOptions = [{
        expirationDate: Date.now() / 1000,
        hasMiniOptions: false,
        calls: [],
        puts: []
      }];
      const dates = (optionsService as any).extractExpirationDates(mockOptions);
      expect(dates).toHaveLength(1);
      expect(dates[0]).toBeInstanceOf(Date);
    });

    it('should handle empty options array', () => {
      const dates = (optionsService as any).extractExpirationDates([]);
      expect(dates).toHaveLength(0);
    });

    it('should handle invalid expiration dates', () => {
      const mockOptions = [{
        expirationDate: 'invalid',
        hasMiniOptions: false,
        calls: [],
        puts: []
      }];
      const dates = (optionsService as any).extractExpirationDates(mockOptions);
      expect(dates).toHaveLength(0);
    });
  });

  describe('calculatePutCallRatio', () => {
    it('should return 1 when no options data is provided', () => {
      const ratio = (optionsService as any).calculatePutCallRatio([]);
      expect(ratio).toBe(1);
    });

    it('should return 1 when both put and call volumes are 0', () => {
      const options = [{
        expirationDate: Date.now() / 1000,
        hasMiniOptions: false,
        calls: [{ volume: { raw: 0 } }],
        puts: [{ volume: { raw: 0 } }]
      }];
      const ratio = (optionsService as any).calculatePutCallRatio(options);
      expect(ratio).toBe(1);
    });

    it('should return 2 when only puts have volume', () => {
      const options = [{
        expirationDate: Date.now() / 1000,
        hasMiniOptions: false,
        calls: [{ volume: { raw: 0 } }],
        puts: [{ volume: { raw: 100 } }]
      }];
      const ratio = (optionsService as any).calculatePutCallRatio(options);
      expect(ratio).toBe(2);
    });

    it('should return 0.5 when only calls have volume', () => {
      const options = [{
        expirationDate: Date.now() / 1000,
        hasMiniOptions: false,
        calls: [{ volume: { raw: 100 } }],
        puts: [{ volume: { raw: 0 } }]
      }];
      const ratio = (optionsService as any).calculatePutCallRatio(options);
      expect(ratio).toBe(0.5);
    });

    it('should calculate correct ratio when both puts and calls have volume', () => {
      const options = [{
        expirationDate: Date.now() / 1000,
        hasMiniOptions: false,
        calls: [{ volume: { raw: 200 } }],
        puts: [{ volume: { raw: 100 } }]
      }];
      const ratio = (optionsService as any).calculatePutCallRatio(options);
      expect(ratio).toBe(0.5); // 100/200 = 0.5
    });
  });

  describe('delay', () => {
    it('should delay execution for specified milliseconds', async () => {
      const delayPromise = (optionsService as any).delay(100);
      jest.advanceTimersByTime(100);
      await delayPromise;
    });
  });
}); 