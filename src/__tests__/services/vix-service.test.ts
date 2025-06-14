import { VIXService } from '../../services/vix-service';
import { Logger } from '../../core/logger';

// Mock fetch
global.fetch = jest.fn();

// Mock Logger
jest.mock('../../core/logger', () => ({
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
      expect(global.fetch).toHaveBeenCalledWith('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX');
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

    it('should handle network errors in fetchVIX', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(vixService.fetchVIX()).rejects.toThrow('Network error');
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
      expect(result).toBe(100); // All 5 values are <= 30 (currentVIX)
      expect(global.fetch).toHaveBeenCalledWith(
        'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1y'
      );
    });

    it('should calculate IV percentile as 20 when currentVIX is the lowest value', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chart: {
            result: [{
              indicators: {
                quote: [{ close: [15, 20, 25, 30, 10] }] // currentVIX = 10
              }
            }]
          }
        })
      });
      const result = await vixService.calculateIVPercentile();
      expect(result).toBe(20); // Only 1 out of 5 values are <= 10
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

    it('should handle network errors in calculateIVPercentile', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      await expect(vixService.calculateIVPercentile()).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle mixed valid and invalid VIX data in calculateIVPercentile', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          chart: {
            result: [{
              indicators: {
                quote: [{
                  close: [null, 15, undefined, 25, 30, null, 20] // Mixed valid and invalid values
                }]
              }
            }]
          }
        })
      });

      const result = await vixService.calculateIVPercentile();
      // Should only consider valid values: [15, 25, 30, 20]
      // Current VIX is 20, which is the 2nd lowest value
      expect(result).toBe(50); // 2 out of 4 values are <= 20
    });
  });
}); 