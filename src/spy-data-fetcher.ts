import { MarketData } from './types';

export class SPYDataFetcher {
  public static readonly YAHOO_FINANCE_API = 'https://query1.finance.yahoo.com/v8/finance/chart/SPY';
  private static readonly CBOE_API = 'https://cdn.cboe.com/api/global/delayed_quotes/options/SPY.json';

  /**
   * Fetch current SPY market data
   */
  static async fetchCurrentMarketData(): Promise<MarketData> {
    try {
      // Fetch more historical data for accurate SMA calculations
      const response = await fetch(this.YAHOO_FINANCE_API + '?interval=1d&range=1y&indicators=quote&includeTimestamps=true');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      const quote = data.chart.result[0].indicators.quote[0];
      const timestamps = data.chart.result[0].timestamp;
      const lastIndex = timestamps.length - 1;

      // Filter out any undefined or null values from the price data
      const validPrices = quote.close.filter((price: number | null) => price !== null && price !== undefined);
      
      // Calculate technical indicators
      const sma50 = this.calculateSMA(validPrices, 50);
      const sma200 = this.calculateSMA(validPrices, 200);
      const macd = this.calculateMACD(validPrices);
      const rsi = this.calculateRSI(validPrices);

      // Fetch additional market data
      const [putCallRatio] = await Promise.all([
        this.fetchPutCallRatio(),
        // this.fetchMarketBreadth(),
        // this.fetchSectorPerformance()
      ]);

      return {
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
        putCallRatio,
        // marketBreadth,
        // sectorPerformance,
        // marketCap: await this.fetchMarketCap(),
        // earningsYield: await this.fetchEarningsYield(),
        // dividendYield: await this.fetchDividendYield()
      };
    } catch (error) {
      console.error('Error fetching SPY data:', error);
      throw error;
    }
  }

  /**
   * Fetch Put/Call Ratio
   */
  private static async fetchPutCallRatio(): Promise<number> {
    try {
      const response = await fetch(this.CBOE_API);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.putCallRatio || 0;
    } catch (error) {
      console.error('Error fetching Put/Call ratio:', error);
      return 0;
    }
  }

//   /**
//    * Fetch Market Breadth
//    */
//   private static async fetchMarketBreadth(): Promise<{ advancing: number; declining: number; unchanged: number }> {
//     try {
//       // Use Yahoo Finance API to get market breadth
//       const response = await fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=true&lang=en-US&region=US&scrIds=market_movers&count=100');
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
//       const data = await response.json();
      
//       // Calculate advancing/declining from the response
//       const quotes = data.finance.result[0].quotes;
//       const advancing = quotes.filter((q: any) => q.regularMarketChangePercent > 0).length;
//       const declining = quotes.filter((q: any) => q.regularMarketChangePercent < 0).length;
//       const unchanged = quotes.filter((q: any) => q.regularMarketChangePercent === 0).length;

//       return {
//         advancing,
//         declining,
//         unchanged
//       };
//     } catch (error) {
//       console.error('Error fetching market breadth:', error);
//       return { advancing: 0, declining: 0, unchanged: 0 };
//     }
//   }

//   /**
//    * Fetch Sector Performance
//    */
//   private static async fetchSectorPerformance(): Promise<{ [sector: string]: number }> {
//     try {
//       // Use Yahoo Finance API to get sector performance
//       const response = await fetch('https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?formatted=true&lang=en-US&region=US&scrIds=sector_performance&count=100');
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
//       const data = await response.json();
      
//       // Transform the response into sector performance object
//       const sectors: { [key: string]: number } = {};
//       const quotes = data.finance.result[0].quotes;
      
//       quotes.forEach((quote: any) => {
//         if (quote.sector) {
//           sectors[quote.sector] = quote.regularMarketChangePercent;
//         }
//       });

//       return sectors;
//     } catch (error) {
//       console.error('Error fetching sector performance:', error);
//       return {};
//     }
//   }

//   /**
//    * Fetch Market Cap
//    */
//   private static async fetchMarketCap(): Promise<number> {
//     try {
//       const response = await fetch(this.YAHOO_FINANCE_API + '?modules=price');
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
//       const data = await response.json();
//       return data.price.marketCap || 0;
//     } catch (error) {
//       console.error('Error fetching market cap:', error);
//       return 0;
//     }
//   }

//   /**
//    * Fetch Earnings Yield
//    */
//   private static async fetchEarningsYield(): Promise<number> {
//     try {
//       const response = await fetch(this.YAHOO_FINANCE_API + '?modules=defaultKeyStatistics');
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
//       const data = await response.json();
//       return data.defaultKeyStatistics.earningsYield || 0;
//     } catch (error) {
//       console.error('Error fetching earnings yield:', error);
//       return 0;
//     }
//   }

//   /**
//    * Fetch Dividend Yield
//    */
//   private static async fetchDividendYield(): Promise<number> {
//     try {
//       const response = await fetch(this.YAHOO_FINANCE_API + '?modules=summaryDetail');
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`);
//       }
//       const data = await response.json();
//       return data.summaryDetail.dividendYield || 0;
//     } catch (error) {
//       console.error('Error fetching dividend yield:', error);
//       return 0;
//     }
//   }

  /**
   * Calculate Simple Moving Average
   */
  private static calculateSMA(data: number[], period: number): number[] {
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
  private static calculateMACD(data: number[]): number[] {
    const ema12 = this.calculateEMA(data, 12);
    const ema26 = this.calculateEMA(data, 26);
    return ema12.map((value, index) => value - ema26[index]);
  }

  /**
   * Calculate EMA
   */
  private static calculateEMA(data: number[], period: number): number[] {
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
  private static calculateRSI(data: number[], period: number = 14): number[] {
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
  private static calculateADX(high: number[], low: number[], close: number[], period: number = 14): number {
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
   * Fetch VIX data
   */
  private static async fetchVIX(): Promise<number> {
    try {
      const response = await fetch(this.YAHOO_FINANCE_API.replace('SPY', '^VIX') + '?interval=1d&range=1d');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return data.chart.result[0].indicators.quote[0].close[0];
    } catch (error) {
      console.error('Error fetching VIX:', error);
      return 0;
    }
  }

  /**
   * Calculate IV Percentile
   */
  private static async calculateIVPercentile(): Promise<number> {
    // This is a placeholder. In a real implementation, you would:
    // 1. Fetch historical option data
    // 2. Calculate historical IV
    // 3. Determine where current IV ranks in the distribution
    return 50; // Default to middle of the range
  }
} 