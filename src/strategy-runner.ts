import { SPYDataFetcher } from './spy-data-fetcher';
import { MarketData } from './types';
import { Backtester } from './backtester';

interface AccountInfo {
  balance: number;
  maxRiskPerTrade: number;
  maxOpenPositions: number;
  currentDrawdown: number;
}

// Account configurations for different account sizes
const accountConfigs: { [key: string]: AccountInfo } = {
  small: {
    balance: 10000,
    maxRiskPerTrade: 0.10, // 10% max
    maxOpenPositions: 2,
    currentDrawdown: 0
  },
  
  medium: {
    balance: 40000,
    maxRiskPerTrade: 0.12, // 12% max
    maxOpenPositions: 3,
    currentDrawdown: 0
  },
  
  large: {
    balance: 100000,
    maxRiskPerTrade: 0.15, // 15% max
    maxOpenPositions: 4,
    currentDrawdown: 0
  },

  // Account in drawdown
  stressed: {
    balance: 32000, // Down from 40k
    maxRiskPerTrade: 0.08, // Reduced max risk
    maxOpenPositions: 2,
    currentDrawdown: 20 // 20% drawdown
  }
};

class StrategyRunner {
  
  /**
   * Run backtest analysis
   */
  static async runBacktest(accountType: string = 'medium'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`RUNNING BACKTEST | ACCOUNT: ${accountType.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);

    try {
      // Fetch historical data
      const response = await fetch(SPYDataFetcher.YAHOO_FINANCE_API + '?interval=1d&range=2y&indicators=quote&includeTimestamps=true');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      const quote = data.chart.result[0].indicators.quote[0];
      const timestamps = data.chart.result[0].timestamp;
      
      // Filter out any null values and ensure we have valid data
      const validData = timestamps.map((timestamp: number, index: number) => {
        const close = quote.close[index];
        const high = quote.high[index];
        const low = quote.low[index];
        
        if (close === null || high === null || low === null) {
          return null;
        }

        return {
          price: close,
          sma50: 0, // Will be calculated
          sma200: 0, // Will be calculated
          macd: 0, // Will be calculated
          rsi: 0, // Will be calculated
          vix: 20, // Default VIX value
          ivPercentile: 50, // Default value
          adx: 0, // Will be calculated
          volume: quote.volume[index] || 0,
          date: new Date(timestamp * 1000)
        };
      }).filter((data: MarketData | null): data is MarketData => data !== null);

      // Calculate technical indicators
      const prices = validData.map((d: MarketData) => d.price);
      const sma50 = this.calculateSMA(prices, 50);
      const sma200 = this.calculateSMA(prices, 200);
      const macd = this.calculateMACD(prices);
      const rsi = this.calculateRSI(prices);

      // Update the data with calculated indicators
      validData.forEach((data: MarketData, index: number) => {
        if (index >= 200) {
          data.sma50 = sma50[index - 50];
          data.sma200 = sma200[index - 200];
          data.macd = macd[index - 26];
          data.rsi = rsi[index - 14];
          data.adx = this.calculateADX(
            validData.slice(index - 14, index + 1).map((d: MarketData) => d.price),
            validData.slice(index - 14, index + 1).map((d: MarketData) => d.price),
            validData.slice(index - 14, index + 1).map((d: MarketData) => d.price)
          );
        }
      });

      // Initialize backtester with valid data
      const accountInfo = accountConfigs[accountType];
      const backtester = new Backtester(validData, accountInfo.balance);
      
      // Run backtest
      const results = await backtester.runBacktest();

      // Display results
      console.log('\nBACKTEST RESULTS:');
      console.log(`Total Trades: ${results.totalTrades}`);
      console.log(`Win Rate: ${(results.winRate * 100).toFixed(1)}%`);
      console.log(`Average Return: ${(results.averageReturn * 100).toFixed(1)}%`);
      console.log(`Max Drawdown: ${(results.maxDrawdown * 100).toFixed(1)}%`);
      console.log(`Sharpe Ratio: ${results.sharpeRatio.toFixed(2)}`);
      console.log(`Profit Factor: ${results.profitFactor.toFixed(2)}`);

      // Display recent trades
      console.log('\nRECENT TRADES:');
      const recentTrades = results.trades.slice(-5);
      recentTrades.forEach(trade => {
        console.log(`\nDate: ${trade.entryDate.toLocaleDateString()}`);
        console.log(`Strategy: ${trade.strategy}`);
        console.log(`Entry: $${trade.entryPrice.toFixed(2)}`);
        console.log(`Exit: $${trade.exitPrice.toFixed(2)}`);
        console.log(`P&L: ${(trade.pnl > 0 ? '+' : '')}${trade.pnl.toFixed(2)}`);
      });

    } catch (error) {
      console.error('Error running backtest:', error);
    }
  }

  /**
   * Calculate Simple Moving Average
   */
  private static calculateSMA(data: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a: number, b: number) => a + b, 0);
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
}

// CLI Command processor
class CLI {
  static processCommand(args: string[]): void {
    const command = args[0];
    
    switch (command) {
      case 'backtest':
        StrategyRunner.runBacktest();
        break;
        
      case 'help':
      default:
        console.log('\n=== OPTIONS STRATEGY ANALYZER CLI ===');
        console.log('\nCommands:');
        console.log('  backtest                 - Historical backtest');
        console.log('  help                     - Show this help');
        break;
    }
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  CLI.processCommand(args);
}

// Export for use as module
export { StrategyRunner, CLI };
export default StrategyRunner;