import { MarketData } from '../types/types';
import { chromium } from 'playwright';
import { Browser } from 'playwright';
import { ConfigService } from '../config/config';
import { Logger } from './logger';
import { MarketDataError } from '../types/errors';

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

interface OptionQuote {
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

// Yahoo API Option Quote (raw)
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

// Yahoo API Underlying Quote (raw)
interface YahooUnderlyingQuote {
  language: string;
  region: string;
  quoteType: string;
  typeDisp: string;
  quoteSourceName: string;
  triggerable: boolean;
  customPriceAlertConfidence: string;
  shortName: string;
  longName: string;
  regularMarketChangePercent: number;
  regularMarketPrice: number;
  exchange: string;
  messageBoardId: string;
  exchangeTimezoneName: string;
  exchangeTimezoneShortName: string;
  gmtOffSetMilliseconds: number;
  market: string;
  esgPopulated: boolean;
  currency: string;
  marketState: string;
  corporateActions: any[];
  postMarketTime: number;
  regularMarketTime: number;
  priceHint: number;
  postMarketChangePercent: number;
  postMarketPrice: number;
  postMarketChange: number;
  regularMarketChange: number;
  regularMarketDayHigh: number;
  regularMarketDayRange: string;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  regularMarketPreviousClose: number;
  bid: number;
  ask: number;
  bidSize: number;
  askSize: number;
  fullExchangeName: string;
  financialCurrency: string;
  regularMarketOpen: number;
  averageDailyVolume3Month: number;
  averageDailyVolume10Day: number;
  fiftyTwoWeekLowChange: number;
  fiftyTwoWeekLowChangePercent: number;
  fiftyTwoWeekRange: string;
  fiftyTwoWeekHighChange: number;
  fiftyTwoWeekHighChangePercent: number;
  fiftyTwoWeekLow: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekChangePercent: number;
  trailingAnnualDividendRate: number;
  trailingPE: number;
  trailingAnnualDividendYield: number;
  dividendYield: number;
  ytdReturn: number;
  trailingThreeMonthReturns: number;
  trailingThreeMonthNavReturns: number;
  netAssets: number;
  epsTrailingTwelveMonths: number;
  sharesOutstanding: number;
  bookValue: number;
  fiftyDayAverage: number;
  fiftyDayAverageChange: number;
  fiftyDayAverageChangePercent: number;
  twoHundredDayAverage: number;
  twoHundredDayAverageChange: number;
  twoHundredDayAverageChangePercent: number;
  netExpenseRatio: number;
  marketCap: number;
  priceToBook: number;
  sourceInterval: number;
  exchangeDataDelayedBy: number;
  tradeable: boolean;
  cryptoTradeable: boolean;
  hasPrePostMarketData: boolean;
  firstTradeDateMilliseconds: number;
  symbol: string;
}

// Yahoo API Options for a single expiration
interface YahooOptionsForExpiration {
  expirationDate: number;
  hasMiniOptions: boolean;
  calls: YahooOptionQuote[];
  puts: YahooOptionQuote[];
}

// Yahoo API OptionChain Result (parent object)
interface YahooOptionChainResult {
  underlyingSymbol: string;
  expirationDates: number[];
  strikes: number[];
  hasMiniOptions: boolean;
  quote: YahooUnderlyingQuote;
  options: YahooOptionsForExpiration[];
}

// Processed options format
interface ProcessedOptions {
  call: { [strike: number]: OptionQuote };
  put: { [strike: number]: OptionQuote };
}

export class MarketDataService {
  private config: ConfigService;
  private logger: Logger;
  private static readonly YAHOO_FINANCE_API = 'https://query1.finance.yahoo.com/v8/finance/chart/SPY';
  private static readonly VIX_API = 'https://query1.finance.com/v8/finance/chart/%5EVIX';
  private static readonly OPTIONS_API = 'https://query1.finance.yahoo.com/v7/finance/options/SPY';
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 5000; // 5 seconds between requests
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
   * Helper function to ensure rate limiting
   */
  private async ensureRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const requestInterval = this.config.getApiConfig().requestInterval;
    
    if (timeSinceLastRequest < requestInterval) {
      await this.delay(requestInterval - timeSinceLastRequest);
    }
    this.lastRequestTime = Date.now();
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
   * Fetch current market data including options chain
   */
  async fetchCurrentMarketData(): Promise<MarketData> {
    try {
      this.logger.info('Fetching current market data');
      
      // Fetch SPY data
      const apiConfig = this.config.getApiConfig();
      const response = await fetch(apiConfig.yahooFinanceApi + '?interval=1d&range=1y&indicators=quote&includeTimestamps=true');
      
      if (!response.ok) {
        throw new MarketDataError(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const quote = data.chart.result[0].indicators.quote[0];
      const timestamps = data.chart.result[0].timestamp;
      const lastIndex = timestamps.length - 1;

      // Calculate technical indicators
      const close = quote.close.filter((price: number | null) => price !== null && price !== undefined);
      const technicalConfig = this.config.getTechnicalConfig();
      
      const sma50 = this.calculateSMA(close, technicalConfig.smaPeriods[0]);
      const sma200 = this.calculateSMA(close, technicalConfig.smaPeriods[1]);
      const macd = this.calculateMACD(close);
      const rsi = this.calculateRSI(close, technicalConfig.rsiPeriod);

      // Fetch options data
      const optionsData = await this.fetchOptionsData();
      const nearestExpiry = this.getNearestExpiry(optionsData);
      const daysToExpiration = this.calculateDaysBetween(new Date(), nearestExpiry);

      const marketData: MarketData = {
        price: quote.close[lastIndex],
        sma50: sma50[sma50.length - 1],
        sma200: sma200[sma200.length - 1],
        macd: macd[macd.length - 1],
        rsi: rsi[rsi.length - 1],
        vix: await this.fetchVIX(),
        ivPercentile: await this.calculateIVPercentile(),
        adx: this.calculateADX(quote.high, quote.low, quote.close),
        volume: quote.volume[lastIndex],
        date: new Date(timestamps[lastIndex] * 1000),
        optionsData: {
          expiryDate: nearestExpiry,
          strikes: optionsData.strikes,
          daysToExpiration,
          options: optionsData.options
        }
      };

      this.logger.info('Successfully fetched market data', { 
        price: marketData.price,
        vix: marketData.vix,
        rsi: marketData.rsi
      });

      return marketData;
    } catch (error) {
      this.logger.error('Error fetching market data', error as Error);
      throw new MarketDataError(`Failed to fetch market data: ${(error as Error).message}`);
    }
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
        const optDate = new Date(opt.expirationDate * 1000); // Convert Unix timestamp to Date
        return optDate.getTime() === closestExpiration.getTime();
      });

      if (!options || options.length === 0) {
        throw new Error('No options found for the selected expiration date');
      }

      return {
        date: new Date(),
        underlyingPrice: optionsData.underlyingPrice,
        strikes: this.processOptions(options),
        ivPercentile: await this.calculateIVPercentile(),
        putCallRatio: this.calculatePutCallRatio(options)
      };
    } catch (error) {
      console.error('Error fetching options data for specific DTE:', error);
      throw error;
    }
  }

  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(data: number[], period: number): number[] {
    if (data.length < period) {
      throw new Error(`Not enough data points for ${period}-day SMA calculation`);
    }

    const sma: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  /**
   * Calculate MACD
   */
  private calculateMACD(data: number[]): number[] {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    return ema12.map((value, index) => value - ema26[index]);
  }

  /**
   * Calculate EMA
   */
  private calculateEMA(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema: number[] = [data[0]];
    
    for (let i = 1; i < data.length; i++) {
      ema.push(data[i] * k + ema[i - 1] * (1 - k));
    }
    
    return ema;
  }

  /**
   * Calculate RSI
   */
  private calculateRSI(data: number[], period: number = 14): number[] {
    const rsi: number[] = [];
    const changes = data.slice(1).map((value, index) => value - data[index]);
    
    for (let i = period; i < changes.length; i++) {
      const gains = changes.slice(i - period, i).filter(change => change > 0).reduce((a, b) => a + b, 0);
      const losses = Math.abs(changes.slice(i - period, i).filter(change => change < 0).reduce((a, b) => a + b, 0));
      
      const rs = gains / losses;
      rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
  }

  /**
   * Calculate ADX
   */
  private calculateADX(high: number[], low: number[], close: number[], period: number = 14): number {
    const tr: number[] = [];
    const plusDM: number[] = [];
    const minusDM: number[] = [];

    for (let i = 1; i < high.length; i++) {
      tr.push(Math.max(
        high[i] - low[i],
        Math.abs(high[i] - close[i - 1]),
        Math.abs(low[i] - close[i - 1])
      ));

      const upMove = high[i] - high[i - 1];
      const downMove = low[i - 1] - low[i];

      plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
      minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    }

    const tr14 = this.calculateEMA(tr, period);
    const plusDM14 = this.calculateEMA(plusDM, period);
    const minusDM14 = this.calculateEMA(minusDM, period);

    const plusDI = plusDM14.map((value, index) => (value / tr14[index]) * 100);
    const minusDI = minusDM14.map((value, index) => (value / tr14[index]) * 100);

    const dx = plusDI.map((value, index) => 
      Math.abs((value - minusDI[index]) / (value + minusDI[index])) * 100
    );

    return this.calculateEMA(dx, period)[dx.length - 1];
  }

  /**
   * Fetch VIX
   */
  public async fetchVIX(): Promise<number> {
    try {
      const response = await fetch(MarketDataService.VIX_API);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.chart.result[0].indicators.quote[0].close[0];
    } catch (error) {
      console.error('Error fetching VIX:', error);
      return 20; // Default value
    }
  }

  /**
   * Calculate IV Percentile
   */
  public async calculateIVPercentile(): Promise<number> {
    try {
      const response = await fetch(MarketDataService.VIX_API + '?interval=1d&range=1y');
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
      console.error('Error calculating IV percentile:', error);
      return 50; // Default value
    }
  }

  /**
   * Fetch options data from Yahoo Finance using Playwright
   */
  private async fetchOptionsData(retryCount = 0): Promise<any> {
    const cacheKey = 'default';
    const cachedData = this.getCachedOptionsData(cacheKey);
    if (cachedData) {
      console.log('Using cached options data');
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
              console.log('Options API URL:', url);
              const json = await response.json();
              optionsResponse = json;
              
              if (!optionsResponse?.optionChain?.result?.[0]) {
                throw new Error('Invalid Yahoo Finance options data format');
              }

              const result = optionsResponse.optionChain.result[0];
              if (!result.options || !Array.isArray(result.options) || result.options.length === 0) {
                throw new Error('No options data found in response');
              }

              console.log('Options data received:', {
                expirationDates: result.expirationDates || [],
                strikes: result.strikes || [],
                options: result.options || [],
                underlyingPrice: result.quote?.regularMarketPrice
              });

              // Log example call and put objects for debugging
              if (result.options[0]?.calls?.[0]) {
                console.log('Example call object:', result.options[0].calls[0]);
              }
              if (result.options[0]?.puts?.[0]) {
                console.log('Example put object:', result.options[0].puts[0]);
              }

              resolve();
            } catch (e) {
              console.error('Error parsing options response:', e);
              reject(e);
            }
          }
        });
      });

      // Navigate to Yahoo Finance options page
      console.log('Navigating to Yahoo Finance options page...');
      await page.goto('https://finance.yahoo.com/quote/SPY/options', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });

      // Click the date button to open the listbox
      console.log('Opening date selector...');
      await page.click('button.tertiary-btn.fin-size-small.menuBtn[data-type="date"]', { timeout: 10000 });

      // Wait for the date options to be available
      await page.waitForSelector('div[role="option"]', { timeout: 10000 });

      // Calculate target date (25 days from now)
      const today = new Date();
      const targetDate = new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000);
      console.log('Target date:', targetDate.toISOString().split('T')[0]);

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

      console.log('Selected date timestamp:', closestDateTimestamp);

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
      console.error('Error fetching Yahoo Finance options data:', error);
      if (browser) {
        await browser.close();
      }
      if (retryCount < 3) {
        console.log(`Retrying in 10 seconds...`);
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
   * Extract unique strikes from options data
   */
  private extractStrikes(options: any[]): number[] {
    const strikes = new Set<number>();
    
    options.forEach(option => {
      if (option.strike) {
        strikes.add(option.strike);
      }
    });

    return Array.from(strikes).sort((a, b) => a - b);
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
        console.warn('Invalid option object found, skipping...');
        return;
      }

      // Process calls
      if (Array.isArray(option.calls)) {
        option.calls.forEach((call: YahooOptionQuote) => {
          try {
            if (!call?.strike?.raw) {
              console.warn('Invalid call option found, skipping...');
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
            console.warn('Error processing call option:', error);
          }
        });
      }
      
      // Process puts
      if (Array.isArray(option.puts)) {
        option.puts.forEach((put: YahooOptionQuote) => {
          try {
            if (!put?.strike?.raw) {
              console.warn('Invalid put option found, skipping...');
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
            console.warn('Error processing put option:', error);
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