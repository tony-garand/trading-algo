import { Logger } from '../core/logger';
import { ConfigService } from '../config/config';
import { chromium, Browser } from 'playwright';
import { YahooOptionChainResponse } from '../types/yahoo';

export interface OptionsData {
  date: Date;
  underlyingPrice: number;
  strikes: {
    call: { [strike: number]: OptionQuote };
    put: { [strike: number]: OptionQuote };
  };
  ivPercentile: number;
  putCallRatio: number;
  options: {
    expirationDate: number;
    hasMiniOptions: boolean;
    calls: any[];
    puts: any[];
  }[];
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

export interface YahooOptionQuote {
  percentChange?: { raw: number; fmt: string };
  openInterest?: { raw: number; fmt: string; longFmt: string };
  strike?: { raw: number; fmt: string };
  change?: { raw: number; fmt: string };
  inTheMoney?: boolean;
  impliedVolatility?: { raw: number; fmt: string };
  volume?: { raw: number; fmt: string; longFmt: string };
  ask?: { raw: number; fmt: string };
  contractSymbol?: string;
  lastTradeDate?: { raw: number; fmt: string; longFmt: string };
  currency?: string;
  expiration?: { raw: number; fmt: string; longFmt: string };
  contractSize?: string;
  bid?: { raw: number; fmt: string };
  lastPrice?: { raw: number; fmt: string };
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface YahooOptionsForExpiration {
  expirationDate: number;
  hasMiniOptions: boolean;
  calls: YahooOptionQuote[];
  puts: YahooOptionQuote[];
}

interface ProcessedOptions {
  call: { [strike: number]: OptionQuote };
  put: { [strike: number]: OptionQuote };
}

interface YahooFinanceResponse {
  optionChain?: {
    result?: Array<{
      options?: YahooOptionsForExpiration[];
    }>;
    error: null;
  };
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
      const expirationDates = this.extractExpirationDates(optionsData);
      
      if (!expirationDates || expirationDates.length === 0) {
        throw new Error(`No expiration date found within ${toleranceDays} days of target ${targetDaysToExpiry} days`);
      }

      const closestExpiration = expirationDates.reduce((closest: Date, current: Date) => {
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
      const options = optionsData.optionChain.result[0].options.find((opt: any) => {
        const optDate = new Date(opt.expirationDate * 1000);
        return optDate.getTime() === closestExpiration.getTime();
      });

      if (!options) {
        throw new Error('No valid options data found after processing');
      }

      try {
        const processedOptions = this.processOptions([options]);
        const putCallRatio = this.calculatePutCallRatio([options]);

        return {
          date: new Date(),
          underlyingPrice: optionsData.optionChain.result[0].quote.regularMarketPrice,
          strikes: processedOptions,
          ivPercentile: 0, // This should be calculated by VIXService
          putCallRatio,
          options: optionsData.optionChain.result[0].options
        };
      } catch (error) {
        throw new Error('No valid options data found after processing');
      }
    } catch (error) {
      this.logger.error('Error fetching options data for specific DTE:', error as Error);
      throw error;
    }
  }

  /**
   * Fetch options data from Yahoo Finance using Playwright
   */
  private async fetchOptionsData(retryCount = 0): Promise<YahooOptionChainResponse> {
    const cacheKey = 'default';
    const cachedData = this.getCachedOptionsData(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    let browser: Browser | null = null;

    try {
      // Launch browser and create context
      browser = await chromium.launch();
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
      const page = await context.newPage();

      // Navigate to Yahoo Finance options page
      await page.goto('https://finance.yahoo.com/quote/SPY/options', {
        waitUntil: 'domcontentloaded',
        timeout: this.config.get('options.navigationTimeout', 30000)
      });

      // Only set up response handler after successful navigation
      let optionsResponse: any = null;
      const responseTimeout = this.config.get('options.responseTimeout', 10000);
      const responsePromise = new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Failed to capture options data response'));
        }, responseTimeout);

        page.on('response', async (response) => {
          const url = response.url();
          if (url.includes('/v7/finance/options/SPY')) {
            try {
              const json = await response.json();
              this.logger.debug('Received options response', { 
                hasOptionChain: !!json?.optionChain,
                hasResult: !!json?.optionChain?.result,
                resultLength: json?.optionChain?.result?.length
              });
              
              optionsResponse = json;
              
              // Validate response structure
              if (!optionsResponse?.optionChain) {
                this.logger.error(
                  'Invalid response: Missing optionChain',
                  new Error('Missing optionChain'),
                  { responseData: JSON.stringify(json) }
                );
                clearTimeout(timeoutId);
                reject(new Error('Invalid Yahoo Finance options data format: Missing optionChain'));
                return;
              }

              if (!optionsResponse.optionChain.result || !Array.isArray(optionsResponse.optionChain.result)) {
                this.logger.error(
                  'Invalid response: Missing or invalid result array',
                  new Error('Invalid result array'),
                  { responseData: JSON.stringify(json) }
                );
                clearTimeout(timeoutId);
                reject(new Error('Invalid Yahoo Finance options data format: Missing result array'));
                return;
              }

              if (optionsResponse.optionChain.result.length === 0) {
                this.logger.error(
                  'Invalid response: Empty result array',
                  new Error('Empty result array'),
                  { responseData: JSON.stringify(json) }
                );
                clearTimeout(timeoutId);
                reject(new Error('Invalid Yahoo Finance options data format: Empty result array'));
                return;
              }

              const result = optionsResponse.optionChain.result[0];
              this.logger.debug('Processing result', {
                hasOptions: !!result.options,
                optionsLength: result.options?.length,
                hasQuote: !!result.quote
              });

              if (!result.options || !Array.isArray(result.options)) {
                this.logger.error(
                  'Invalid response: Missing or invalid options array',
                  new Error('Invalid options array'),
                  { resultData: JSON.stringify(result) }
                );
                clearTimeout(timeoutId);
                reject(new Error('Invalid Yahoo Finance options data format: Missing options array'));
                return;
              }

              if (result.options.length === 0) {
                this.logger.error(
                  'Invalid response: Empty options array',
                  new Error('Empty options array'),
                  { resultData: JSON.stringify(result) }
                );
                clearTimeout(timeoutId);
                reject(new Error('No options data found in response'));
                return;
              }

              clearTimeout(timeoutId);
              resolve();
            } catch (e) {
              const error = e instanceof Error ? e : new Error(String(e));
              this.logger.error('Error processing response', error);
              clearTimeout(timeoutId);
              reject(error);
            }
          }
        });
      });

      // Click the date button to open the listbox
      await page.click('button[data-type="date"]', {
        timeout: this.config.get('options.clickTimeout', 5000)
      });

      // Wait for the listbox to appear
      await page.waitForSelector('div[role="listbox"]', {
        timeout: this.config.get('options.selectorTimeout', 5000)
      });

      // Get all expiration dates and find the closest to 25 days
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 25);

      const expirationOptions = await page.$$('div[role="listbox"] div[role="option"]');
      let closestOption = null;
      let minDiff = Infinity;

      for (const option of expirationOptions) {
        const dateText = await option.textContent();
        if (!dateText) continue;

        // Extract the date from the text (format: "MMM DD, YYYY")
        const dateMatch = dateText.match(/([A-Za-z]+)\s+(\d+),\s+(\d+)/);
        if (!dateMatch) continue;

        const [, month, day, year] = dateMatch;
        const optionDate = new Date(`${month} ${day}, ${year}`);
        const diff = Math.abs(optionDate.getTime() - targetDate.getTime());

        if (diff < minDiff) {
          minDiff = diff;
          closestOption = option;
        }
      }

      if (closestOption) {
        await closestOption.click();
        this.logger.debug('Selected expiration date closest to 25 days', {
          targetDate: targetDate.toISOString(),
          selectedDate: await closestOption.textContent()
        });
      } else {
        this.logger.warn('Could not find suitable expiration date');
      }

      // Wait for the response
      await responsePromise;

      // Cache the response
      this.cacheOptionsData(cacheKey, optionsResponse);

      return optionsResponse;
    } catch (error) {
      this.logger.error('Error fetching options data', error as Error);
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Extract expiration dates from YahooOptionChainResponse
   */
  private extractExpirationDates(response: YahooOptionChainResponse): Date[] {
    // Validate the response structure
    if (!response?.optionChain?.result?.[0]?.options) {
      this.logger.warn('Invalid Yahoo Finance response structure for expiration extraction', {
        hasOptionChain: !!response?.optionChain,
        hasResult: !!response?.optionChain?.result,
        resultLength: response?.optionChain?.result?.length,
        hasOptions: !!response?.optionChain?.result?.[0]?.options
      });
      return [];
    }

    const optionsArr = response.optionChain.result[0].options;
    if (!Array.isArray(optionsArr) || optionsArr.length === 0) {
      this.logger.warn('No options data available after extraction');
      return [];
    }

    const dates = optionsArr
      .map(option => {
        if (!option.expirationDate) {
          this.logger.debug('Option missing expirationDate:', JSON.stringify(option));
          return null;
        }
        const timestamp = typeof option.expirationDate === 'number'
          ? option.expirationDate * 1000
          : new Date(option.expirationDate).getTime();
        if (isNaN(timestamp)) {
          this.logger.debug('Invalid timestamp for option:', JSON.stringify(option));
          return null;
        }
        return new Date(timestamp);
      })
      .filter((date): date is Date => date !== null && date.getTime() > 0);

    this.logger.debug('Extracted dates:', dates.map(d => d.toISOString()));
    return dates;
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

  private calculatePutCallRatio(options: YahooOptionsForExpiration[]): number {
    if (!options || options.length === 0) {
      return 1; // Default to 1 when no options data
    }

    let totalPutVolume = 0;
    let totalCallVolume = 0;

    options.forEach(option => {
      if (option.puts) {
        totalPutVolume += option.puts.reduce((sum, put) => {
          const volume = put.volume?.raw || 0;
          return sum + volume;
        }, 0);
      }

      if (option.calls) {
        totalCallVolume += option.calls.reduce((sum, call) => {
          const volume = call.volume?.raw || 0;
          return sum + volume;
        }, 0);
      }
    });

    // If no volume in either puts or calls, return 1
    if (totalPutVolume === 0 && totalCallVolume === 0) {
      return 1;
    }

    // If only puts have volume, return 2 (very bearish)
    if (totalCallVolume === 0) {
      return 2;
    }

    // If only calls have volume, return 0.5 (very bullish)
    if (totalPutVolume === 0) {
      return 0.5;
    }

    return Number((totalPutVolume / totalCallVolume).toFixed(2));
  }
} 