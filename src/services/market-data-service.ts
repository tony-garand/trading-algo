import { MarketData } from '../types/types';
import { ConfigService } from '../config/config';
import { Logger } from '../core/logger';
import { MarketDataError } from '../types/errors';
import { TechnicalIndicatorsService } from './technical-indicators-service';
import { VIXService } from './vix-service';
import { OptionsService } from './options-service';

export class MarketDataService {
  private config: ConfigService;
  private logger: Logger;
  private technicalIndicators: TechnicalIndicatorsService;
  private vixService: VIXService;
  private optionsService: OptionsService;

  constructor() {
    this.config = ConfigService.getInstance();
    this.logger = Logger.getInstance();
    this.technicalIndicators = new TechnicalIndicatorsService();
    this.vixService = new VIXService();
    this.optionsService = new OptionsService();
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
      
      const sma50 = this.technicalIndicators.calculateSMA(close, technicalConfig.smaPeriods[0]);
      const sma200 = this.technicalIndicators.calculateSMA(close, technicalConfig.smaPeriods[1]);
      const macd = this.technicalIndicators.calculateMACD(close);
      const rsi = this.technicalIndicators.calculateRSI(close, technicalConfig.rsiPeriod);

      // Fetch options data
      const optionsData = await this.optionsService.getOptionsDataForDaysToExpiry(25);
      const nearestExpiry = new Date(optionsData.date);
      const daysToExpiration = this.calculateDaysBetween(new Date(), nearestExpiry);

      // Create options array with both calls and puts
      const options = [
        ...Object.entries(optionsData.strikes.call).map(([strike, call]) => ({
          option: 'call',
          strike: Number(strike),
          type: 'call' as const,
          bid: call.bid,
          ask: call.ask,
          bid_size: 0, // Not provided by Yahoo
          ask_size: 0, // Not provided by Yahoo
          last_trade_price: call.lastPrice,
          last_trade_time: new Date().toISOString(),
          volume: call.volume,
          open_interest: call.openInterest,
          delta: call.delta,
          gamma: call.gamma,
          theta: call.theta,
          vega: call.vega,
          rho: 0, // Not provided by Yahoo
          theo: 0 // Not provided by Yahoo
        })),
        ...Object.entries(optionsData.strikes.put).map(([strike, put]) => ({
          option: 'put',
          strike: Number(strike),
          type: 'put' as const,
          bid: put.bid,
          ask: put.ask,
          bid_size: 0, // Not provided by Yahoo
          ask_size: 0, // Not provided by Yahoo
          last_trade_price: put.lastPrice,
          last_trade_time: new Date().toISOString(),
          volume: put.volume,
          open_interest: put.openInterest,
          delta: put.delta,
          gamma: put.gamma,
          theta: put.theta,
          vega: put.vega,
          rho: 0, // Not provided by Yahoo
          theo: 0 // Not provided by Yahoo
        }))
      ];

      const vix = await this.vixService.fetchVIX();
      const ivPercentile = await this.vixService.calculateIVPercentile();
      const adxResult = this.technicalIndicators.calculateADX(quote.high, quote.low, quote.close);

      const marketData: MarketData = {
        price: quote.close[lastIndex],
        sma50: sma50[sma50.length - 1],
        sma200: sma200[sma200.length - 1],
        macd: macd[macd.length - 1],
        rsi: rsi[rsi.length - 1],
        vix,
        ivPercentile,
        adx: adxResult.adx,
        plusDI: adxResult.plusDI,
        minusDI: adxResult.minusDI,
        volume: quote.volume[lastIndex],
        date: new Date(timestamps[lastIndex] * 1000),
        optionsData: {
          expiryDate: nearestExpiry,
          strikes: Object.keys(optionsData.strikes.call).map(Number),
          daysToExpiration,
          options
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
   * Calculate days between two dates
   */
  private calculateDaysBetween(startDate: Date, endDate: Date): number {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
} 