import { MarketDataService } from './services/market-data-service';
import { OptionsStrategyAnalyzer } from './strategies/options-strategy-analyzer';
import { Container } from './services/container';
import { accountConfigs } from './config/account-config';
import { CLIFormatter } from './core/cli/formatter';
import { QuestionHandler } from './core/cli/questions';
import * as readline from 'readline';

class StrategyRunner {
  private container: Container;
  private analyzer: OptionsStrategyAnalyzer;
  
  constructor(accountType: string = 'medium') {
    const accountInfo = accountConfigs[accountType];
    this.container = Container.getInstance();
    this.container.initializeServices(accountInfo);
    this.analyzer = this.container.get<OptionsStrategyAnalyzer>('strategyAnalyzer');
  }

  /**
   * Get current strategy recommendation
   */
  async getCurrentStrategy(): Promise<void> {
    try {
      // const marketDataService = this.container.get<MarketDataService>('marketDataService');
      
      // // Fetch current market data
      // const marketData = await marketDataService.fetchCurrentMarketData();
      
      // Get strategy recommendation
      const recommendation = await this.analyzer.getCurrentRecommendation();
      
      // Display recommendation using CLIFormatter
      console.log(CLIFormatter.formatRecommendation(recommendation));
      
    } catch (error) {
      console.error('Error getting strategy recommendation:', error);
    }
  }
}

// CLI Command processor
class CLI {
  private static rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  static async processCommand(args: string[]): Promise<void> {
    const command = args[0];
    const accountType = args[1] || 'medium';
    
    switch (command) {
      case 'strategy':
        const runner = new StrategyRunner(accountType);
        await runner.getCurrentStrategy();
        break;

      case 'ask':
        await this.startQuestionMode();
        break;
        
      case 'help':
      default:
        console.log('\n=== OPTIONS STRATEGY ANALYZER CLI ===');
        console.log('\nCommands:');
        console.log('  backtest [account-type]  - Run historical backtest');
        console.log('  strategy [account-type]  - Get current strategy recommendation');
        console.log('  ask                      - Enter interactive question mode');
        console.log('  help                     - Show this help');
        console.log('\nAccount Types:');
        console.log('  small                    - $10,000 account');
        console.log('  medium                   - $40,000 account (default)');
        console.log('  large                    - $100,000 account');
        console.log('  stressed                 - Account in drawdown');
        break;
    }
  }

  private static async startQuestionMode(): Promise<void> {
    console.log('\n=== Question Mode ===');
    console.log('Ask questions about metrics, strategies, or concepts.');
    console.log('Type "exit" to quit.\n');

    const askQuestion = async () => {
      this.rl.question('Your question: ', async (question) => {
        if (question.toLowerCase() === 'exit') {
          this.rl.close();
          return;
        }

        const answer = await QuestionHandler.handleQuestion(question);
        console.log('\n' + answer + '\n');
        askQuestion();
      });
    };

    await askQuestion();
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  CLI.processCommand(args);
}

// Export for use in other files
export { StrategyRunner, CLI };