import { Logger } from '../core/logger';

export class VIXService {
  private logger: Logger;
  private static readonly VIX_API = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX';

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Fetch current VIX value
   * @throws Error if VIX data cannot be fetched or is invalid
   */
  public async fetchVIX(): Promise<number> {
    try {
      const response = await fetch(VIXService.VIX_API);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      // Check if we have valid data structure
      if (!data?.chart?.result?.[0]?.meta?.regularMarketPrice) {
        throw new Error('Invalid VIX data structure received');
      }

      // Use regularMarketPrice as it's more reliable than quote data
      return data.chart.result[0].meta.regularMarketPrice;
    } catch (error) {
      this.logger.error('Error fetching VIX:', error as Error);
      throw error; // Re-throw the error instead of returning a default value
    }
  }

  /**
   * Calculate IV Percentile using VIX data
   * @throws Error if VIX data cannot be fetched or is invalid
   */
  public async calculateIVPercentile(): Promise<number> {
    try {
      const response = await fetch(VIXService.VIX_API + '?interval=1d&range=1y');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Check if we have valid data structure
      if (!data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close) {
        throw new Error('Invalid VIX data structure received');
      }

      const vixData = data.chart.result[0].indicators.quote[0].close;
      const validVIX = vixData.filter((v: number | null) => v !== null && v !== undefined);
      
      if (validVIX.length === 0) {
        throw new Error('No valid VIX data available');
      }

      const currentVIX = validVIX[validVIX.length - 1];
      const sortedVIX = [...validVIX].sort((a, b) => a - b);
      
      // Count how many values are less than or equal to current VIX
      let count = 0;
      for (const vix of sortedVIX) {
        if (vix <= currentVIX) {
          count++;
        }
      }
      
      return (count / sortedVIX.length) * 100;
    } catch (error) {
      this.logger.error('Error calculating IV percentile:', error as Error);
      throw error; // Re-throw the error instead of returning a default value
    }
  }
} 