import { Logger } from '../core/logger';
import { ConfigService } from '../config/config';
import { chromium, Browser } from 'playwright';

export interface OptionsData {
  date: Date;
  underlyingPrice: number;
  strikes: {
    call: { [strike: number]: OptionQuote };
    put: { [strike: number]: OptionQuote };
  };
  ivPercentile: number;
  putCallRatio: number;
}

export interface OptionQuote {
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
}

interface YahooOptionQuote {
  percentChange: { raw: number; fmt: string };
  openInterest: { raw: number; fmt: string; longFmt: string };
  strike: { raw: number; fmt: string };
  change: { raw: number; fmt: string };
  inTheMoney: boolean;
  impliedVolatility: { raw: number; fmt: string };
  volume: { raw: number; fmt: string; longFmt: string };
  ask: { raw: number; fmt: string };
  contractSymbol: string;
  lastTradeDate: { raw: number; fmt: string; longFmt: string };
  currency: string;
  expiration: { raw: number; fmt: string; longFmt: string };
  contractSize: string;
  bid: { raw: number; fmt: string };
  lastPrice: { raw: number; fmt: string };
}

interface YahooOptionsForExpiration {
  expirationDate: number;
  hasMiniOptions: boolean;
  calls: YahooOptionQuote[];
  puts: YahooOptionQuote[];
}

interface ProcessedOptions {
  call: { [strike: number]: OptionQuote };
  put: { [strike: number]: OptionQuote };
}

export class OptionsService {
  private config: ConfigService;
  private logger: Logger;
  private static readonly OPTIONS_API = 'https://query1.finance.yahoo.com/v7/finance/options/SPY';
  private optionsDataCache: { [key: string]: { data: any, timestamp: number } } = {};
  private readonly CACHE_DURATION = 60000; // 1 minute cache duration

  constructor() {
    this.config = ConfigService.getInstance();
    this.logger = Logger.getInstance();
  }

  /**
   * Helper function to add delay between requests
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get cached options data if available and not expired
   */
  private getCachedOptionsData(key: string): any | null {
    if (!this.config.getCacheConfig().enabled) {
      return null;
    }

    const cached = this.optionsDataCache[key];
    if (cached && Date.now() - cached.timestamp < this.config.getCacheConfig().duration) {
      this.logger.debug('Using cached options data', { key });
      return cached.data;
    }
    return null;
  }

  /**
   * Cache options data
   */
  private cacheOptionsData(key: string, data: any): void {
    if (!this.config.getCacheConfig().enabled) {
      return;
    }

    this.optionsDataCache[key] = {
      data,
      timestamp: Date.now()
    };
    this.logger.debug('Cached options data', { key });
  }

  /**
   * Fetch options data for a specific number of days to expiration
   */
  async getOptionsDataForDaysToExpiry(targetDaysToExpiry: number, toleranceDays: number = 5): Promise<OptionsData> {
    try {
      const optionsData = await this.fetchOptionsData();
      const today = new Date();
      
      // Find the expiration date closest to target days
      const targetDate = new Date(today.getTime() + targetDaysToExpiry * 24 * 60 * 60 * 1000);
      const closestExpiration = optionsData.expirations.reduce((closest: Date, current: Date) => {
        const currentDiff = Math.abs(current.getTime() - targetDate.getTime());
        const closestDiff = Math.abs(closest.getTime() - targetDate.getTime());
        return currentDiff < closestDiff ? current : closest;
      });

      // Check if the closest expiration is within tolerance
      const daysToClosest = this.calculateDaysBetween(today, closestExpiration);
      if (Math.abs(daysToClosest - targetDaysToExpiry) > toleranceDays) {
        throw new Error(`No expiration date found within ${toleranceDays} days of target ${targetDaysToExpiry} days`);
      }

      // Process options data for the closest expiration
      const options = optionsData.options.filter((opt: YahooOptionsForExpiration) => {
        const optDate = new Date(opt.expirationDate * 1000);
        return optDate.getTime() === closestExpiration.getTime();
      });

      if (!options || options.length === 0) {
        throw new Error('No options found for the selected expiration date');
      }

      return {
        date: new Date(),
        underlyingPrice: optionsData.underlyingPrice,
        strikes: this.processOptions(options),
        ivPercentile: 0, // This should be calculated by VIXService
        putCallRatio: this.calculatePutCallRatio(options)
      };
    } catch (error) {
      this.logger.error('Error fetching options data for specific DTE:', error as Error);
      throw error;
    }
  }

  /**
   * Fetch options data from Yahoo Finance using Playwright
   */
  private async fetchOptionsData(retryCount = 0): Promise<any> {
    const cacheKey = 'default';
    const cachedData = this.getCachedOptionsData(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    let browser: Browser | null = null;

    try {
      browser = await chromium.launch();
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
      const page = await context.newPage();

      // Set up response handler before navigation
      let optionsResponse: any = null;
      let responsePromise = new Promise<void>((resolve, reject) => {
        page.on('response', async (response) => {
          const url = response.url();
          if (url.includes('/v7/finance/options/SPY')) {
            try {
              const json = await response.json();
              optionsResponse = json;
              
              if (!optionsResponse?.optionChain?.result?.[0]) {
                throw new Error('Invalid Yahoo Finance options data format');
              }

              const result = optionsResponse.optionChain.result[0];
              if (!result.options || !Array.isArray(result.options) || result.options.length === 0) {
                throw new Error('No options data found in response');
              }

              resolve();
            } catch (e) {
              reject(e);
            }
          }
        });
      });

      // Navigate to Yahoo Finance options page
      await page.goto('https://finance.yahoo.com/quote/SPY/options', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Click the date button to open the listbox
      await page.click('button.tertiary-btn.fin-size-small.menuBtn[data-type="date"]', { timeout: 10000 });

      // Wait for the date options to be available
      await page.waitForSelector('div[role="option"]', { timeout: 10000 });

      // Calculate target date (25 days from now)
      const today = new Date();
      const targetDate = new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000);

      // Get all available dates and find the closest to target
      const closestDateTimestamp = await page.evaluate((targetTimestamp) => {
        const options = Array.from(document.querySelectorAll('div[role="option"]'));
        if (options.length === 0) {
          throw new Error('No date options found');
        }
        return options.reduce((closest, current) => {
          const currentTimestamp = parseInt(current.getAttribute('data-value') || '0');
          const currentDiff = Math.abs(currentTimestamp - targetTimestamp);
          const closestDiff = Math.abs(parseInt(closest.getAttribute('data-value') || '0') - targetTimestamp);
          return currentDiff < closestDiff ? current : closest;
        }).getAttribute('data-value');
      }, Math.floor(targetDate.getTime() / 1000));

      if (!closestDateTimestamp) {
        throw new Error('Failed to find closest date');
      }

      // Click the closest date option
      await page.click(`div[role="option"][data-value="${closestDateTimestamp}"]`);

      // Wait for the response with a timeout
      try {
        await Promise.race([
          responsePromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for options data')), 30000))
        ]);
      } catch (error) {
        throw new Error('Failed to capture options data response');
      }

      if (!optionsResponse?.optionChain?.result?.[0]) {
        throw new Error('No valid options data found');
      }

      const result = optionsResponse.optionChain.result[0];
      const processedOptions = this.processOptions(result.options);
      
      const resolvedData = {
        expirations: this.extractExpirationDates(result.options),
        strikes: processedOptions,
        options: result.options,
        underlyingPrice: result.quote.regularMarketPrice
      };

      // Cache the data before returning
      this.cacheOptionsData(cacheKey, resolvedData);
      return resolvedData;

    } catch (error) {
      this.logger.error('Error fetching Yahoo Finance options data:', error as Error);
      if (browser) {
        await browser.close();
      }
      if (retryCount < 3) {
        await this.delay(10000);
        return this.fetchOptionsData(retryCount + 1);
      }
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Extract expiration dates from options data
   */
  private extractExpirationDates(options: any[]): Date[] {
    const expirations = new Set<string>();
    
    options.forEach(option => {
      if (option.expirationDate) {
        expirations.add(option.expirationDate.toString());
      }
    });

    return Array.from(expirations)
      .map(date => new Date(parseInt(date) * 1000))
      .sort((a, b) => a.getTime() - b.getTime());
  }

  /**
   * Get the nearest valid expiry date from options chain
   */
  private getNearestExpiry(optionsData: any): Date {
    const today = new Date();
    return optionsData.expirations.find((date: Date) => date > today) || this.getNextFriday();
  }

  /**
   * Get the next Friday's date
   */
  private getNextFriday(): Date {
    const today = new Date();
    const daysUntilFriday = (5 - today.getDay() + 7) % 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    return nextFriday;
  }

  /**
   * Calculate days between two dates
   */
  private calculateDaysBetween(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  private processOptions(options: YahooOptionsForExpiration[]): ProcessedOptions {
    const calls: { [strike: number]: OptionQuote } = {};
    const puts: { [strike: number]: OptionQuote } = {};
    
    if (!options || !Array.isArray(options) || options.length === 0) {
      throw new Error('Invalid options data format');
    }

    options.forEach(option => {
      if (!option || typeof option !== 'object') {
        this.logger.warn('Invalid option object found, skipping...');
        return;
      }

      // Process calls
      if (Array.isArray(option.calls)) {
        option.calls.forEach((call: YahooOptionQuote) => {
          try {
            if (!call?.strike?.raw) {
              this.logger.warn('Invalid call option found, skipping...');
              return;
            }

            const strike = call.strike.raw;
            calls[strike] = {
              strike: strike,
              lastPrice: call.lastPrice?.raw ?? 0,
              bid: call.bid?.raw ?? 0,
              ask: call.ask?.raw ?? 0,
              volume: call.volume?.raw ?? 0,
              openInterest: call.openInterest?.raw ?? 0,
              impliedVolatility: call.impliedVolatility?.raw ?? 0,
              delta: 0, // Not provided by Yahoo
              gamma: 0, // Not provided by Yahoo
              theta: 0, // Not provided by Yahoo
              vega: 0   // Not provided by Yahoo
            };
          } catch (error) {
            this.logger.warn('Error processing call option:', error as Error);
          }
        });
      }
      
      // Process puts
      if (Array.isArray(option.puts)) {
        option.puts.forEach((put: YahooOptionQuote) => {
          try {
            if (!put?.strike?.raw) {
              this.logger.warn('Invalid put option found, skipping...');
              return;
            }

            const strike = put.strike.raw;
            puts[strike] = {
              strike: strike,
              lastPrice: put.lastPrice?.raw ?? 0,
              bid: put.bid?.raw ?? 0,
              ask: put.ask?.raw ?? 0,
              volume: put.volume?.raw ?? 0,
              openInterest: put.openInterest?.raw ?? 0,
              impliedVolatility: put.impliedVolatility?.raw ?? 0,
              delta: 0, // Not provided by Yahoo
              gamma: 0, // Not provided by Yahoo
              theta: 0, // Not provided by Yahoo
              vega: 0   // Not provided by Yahoo
            };
          } catch (error) {
            this.logger.warn('Error processing put option:', error as Error);
          }
        });
      }
    });

    // Validate that we have some data
    if (Object.keys(calls).length === 0 && Object.keys(puts).length === 0) {
      throw new Error('No valid options data found after processing');
    }

    return { call: calls, put: puts };
  }

  private calculatePutCallRatio(options: any[]): number {
    const calls = options.filter(opt => opt.type === 'call');
    const puts = options.filter(opt => opt.type === 'put');
    const totalCallVolume = calls.reduce((sum, call) => sum + call.volume, 0);
    const totalPutVolume = puts.reduce((sum, put) => sum + put.volume, 0);
    return totalPutVolume / totalCallVolume;
  }
} 