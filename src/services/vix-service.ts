import { Logger } from '../core/logger';

export class VIXService {
  private logger: Logger;
  private static readonly VIX_API = 'https://query1.finance.com/v8/finance/chart/%5EVIX';

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Fetch current VIX value
   */
  public async fetchVIX(): Promise<number> {
    try {
      const response = await fetch(VIXService.VIX_API);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.chart.result[0].indicators.quote[0].close[0];
    } catch (error) {
      this.logger.error('Error fetching VIX:', error as Error);
      return 20; // Default value
    }
  }

  /**
   * Calculate IV Percentile
   */
  public async calculateIVPercentile(): Promise<number> {
    try {
      const response = await fetch(VIXService.VIX_API + '?interval=1d&range=1y');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      const vixData = data.chart.result[0].indicators.quote[0].close;
      const validVIX = vixData.filter((v: number | null) => v !== null && v !== undefined);
      
      if (validVIX.length === 0) {
        return 50;
      }

      const currentVIX = validVIX[validVIX.length - 1];
      const sortedVIX = [...validVIX].sort((a, b) => a - b);
      return (sortedVIX.indexOf(currentVIX) / sortedVIX.length) * 100;
    } catch (error) {
      this.logger.error('Error calculating IV percentile:', error as Error);
      return 50; // Default value
    }
  }
} 