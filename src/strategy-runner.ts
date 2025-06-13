import { MarketDataService } from './market-data-service';
import { MarketData } from './types';
import { Backtester } from './backtester';
import { OptionsStrategyAnalyzer } from './options-strategy-analyzer';

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
  private analyzer: OptionsStrategyAnalyzer;
  
  constructor(accountType: string = 'medium') {
    const accountInfo = accountConfigs[accountType];
    this.analyzer = new OptionsStrategyAnalyzer(accountInfo);
  }
  
  /**
   * Run backtest analysis
   */
  static async runBacktest(accountType: string = 'medium'): Promise<void> {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`RUNNING BACKTEST | ACCOUNT: ${accountType.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);

    try {
      // Initialize backtester with account balance
      const accountInfo = accountConfigs[accountType];
      const backtester = new Backtester(accountInfo.balance);
      
      // Initialize backtester with historical data
      console.log('Initializing backtester with historical data...');
      await backtester.initialize();
      
      // Run backtest
      console.log('Running backtest...');
      const results = await backtester.runBacktest();

      // Display results
      console.log('\nBACKTEST RESULTS:');
      console.log(`Total Trades: ${results.totalTrades}`);
      console.log(`Win Rate: ${results.winRate.toFixed(1)}%`);
      console.log(`Average Return: ${results.averageReturn.toFixed(1)}%`);
      console.log(`Max Drawdown: ${results.maxDrawdown.toFixed(1)}%`);
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
   * Get current strategy recommendation
   */
  async getCurrentStrategy(): Promise<void> {
    try {
      // Fetch current market data
      const marketData = await MarketDataService.fetchCurrentMarketData();
      
      // Get strategy recommendation
      const recommendation = await this.analyzer.getCurrentRecommendation(marketData);
      
      // Display recommendation
      console.log(this.analyzer.getFormattedRecommendation(recommendation));
      
    } catch (error) {
      console.error('Error getting strategy recommendation:', error);
    }
  }
}

// CLI Command processor
class CLI {
  static processCommand(args: string[]): void {
    const command = args[0];
    const accountType = args[1] || 'medium';
    
    switch (command) {
      case 'backtest':
        StrategyRunner.runBacktest(accountType);
        break;
        
      case 'strategy':
        const runner = new StrategyRunner(accountType);
        runner.getCurrentStrategy();
        break;
        
      case 'help':
      default:
        console.log('\n=== OPTIONS STRATEGY ANALYZER CLI ===');
        console.log('\nCommands:');
        console.log('  backtest [account-type]  - Run historical backtest');
        console.log('  strategy [account-type]  - Get current strategy recommendation');
        console.log('  help                     - Show this help');
        console.log('\nAccount Types:');
        console.log('  small                    - $10,000 account');
        console.log('  medium                   - $40,000 account (default)');
        console.log('  large                    - $100,000 account');
        console.log('  stressed                 - Account in drawdown');
        break;
    }
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  CLI.processCommand(args);
}

// Export for use in other files
export { StrategyRunner, CLI };