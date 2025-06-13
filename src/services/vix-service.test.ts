import { VIXService } from './vix-service';
import { Logger } from '../core/logger';

// Mock fetch
global.fetch = jest.fn();

// Mock Logger
jest.mock('../core/logger', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      error: jest.fn(),
    }),
  },
}));

describe('VIXService', () => {
  let vixService: VIXService;
  let mockLogger: jest.Mocked<Logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    vixService = new VIXService();
    mockLogger = Logger.getInstance() as jest.Mocked<Logger>;
  });

  describe('fetchVIX', () => {
    const mockVIXResponse = {
      chart: {
        result: [{
          meta: {
            regularMarketPrice: 15.5
          }
        }]
      }
    };

    it('should fetch and return current VIX value', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockVIXResponse)
      });

      const result = await vixService.fetchVIX();
      expect(result).toBe(15.5);
      expect(global.fetch).toHaveBeenCalledWith('https://query1.finance.com/v8/finance/chart/%5EVIX');
    });

    it('should throw error when API response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(vixService.fetchVIX()).rejects.toThrow('HTTP error! status: 500');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw error when VIX data structure is invalid', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ chart: { result: [] } })
      });

      await expect(vixService.fetchVIX()).rejects.toThrow('Invalid VIX data structure received');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('calculateIVPercentile', () => {
    const mockHistoricalVIXResponse = {
      chart: {
        result: [{
          indicators: {
            quote: [{
              close: [10, 15, 20, 25, 30]
            }]
          }
        }]
      }
    };

    it('should calculate IV percentile correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockHistoricalVIXResponse)
      });

      const result = await vixService.calculateIVPercentile();
      expect(result).toBe(60); // 3 out of 5 values are <= 20
      expect(global.fetch).toHaveBeenCalledWith(
        'https://query1.finance.com/v8/finance/chart/%5EVIX?interval=1d&range=1y'
      );
    });

    it('should throw error when API response is not ok', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      await expect(vixService.calculateIVPercentile()).rejects.toThrow('HTTP error! status: 500');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw error when VIX data structure is invalid', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ chart: { result: [] } })
      });

      await expect(vixService.calculateIVPercentile()).rejects.toThrow('Invalid VIX data structure received');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw error when no valid VIX data is available', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chart: {
            result: [{
              indicators: {
                quote: [{
                  close: [null, null, null]
                }]
              }
            }]
          }
        })
      });

      await expect(vixService.calculateIVPercentile()).rejects.toThrow('No valid VIX data available');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
}); 