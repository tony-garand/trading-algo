import { VIXService } from '../../services/vix-service';

// Skip these tests by default unless INTEGRATION_TESTS=true
const describeIf = (condition: boolean) => condition ? describe : describe.skip;

describeIf(process.env.INTEGRATION_TESTS === 'true')('VIXService Integration Tests', () => {
  let vixService: VIXService;

  beforeAll(() => {
    vixService = new VIXService();
  });

  describe('fetchVIX', () => {
    it('should fetch current VIX value from the API', async () => {
      const vix = await vixService.fetchVIX();
      
      // VIX typically ranges between 10 and 40
      expect(vix).toBeGreaterThan(0);
      expect(vix).toBeLessThan(100);
      expect(typeof vix).toBe('number');
    }, 10000); // Increased timeout for API call
  });

  describe('calculateIVPercentile', () => {
    it('should calculate IV percentile from historical data', async () => {
      const percentile = await vixService.calculateIVPercentile();
      
      // Percentile should be between 0 and 100
      expect(percentile).toBeGreaterThanOrEqual(0);
      expect(percentile).toBeLessThanOrEqual(100);
      expect(typeof percentile).toBe('number');
    }, 15000); // Increased timeout for historical data fetch
  });

  describe('API Response Structure', () => {
    it('should return data in the expected format', async () => {
      const response = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1y');
      const data = await response.json();

      // Verify the basic structure of the API response
      expect(data).toHaveProperty('chart');
      expect(data.chart).toHaveProperty('result');
      expect(Array.isArray(data.chart.result)).toBe(true);
      expect(data.chart.result[0]).toHaveProperty('meta');
      expect(data.chart.result[0].meta).toHaveProperty('regularMarketPrice');
    }, 10000);
  });
}); 