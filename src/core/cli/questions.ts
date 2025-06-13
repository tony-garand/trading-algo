import { CLI_METRICS, getMetricDescription } from './metrics';

export class QuestionHandler {
  private static readonly COMMON_QUESTIONS = {
    'what is probability of profit': 'Probability of Profit is the theoretical probability of profit at expiration based on option Greeks. It differs from Expected Win Rate because it only considers the final outcome at expiration, while Expected Win Rate includes our ability to manage trades actively and exit early.',
    'what is expected win rate': 'Expected Win Rate is a comprehensive metric that includes historical performance, current market conditions, technical indicators, and our ability to exit trades early for profit. It\'s typically higher than Probability of Profit because we don\'t hold until expiration in most cases.',
    'how is position size calculated': 'Position size is calculated based on account balance, risk parameters, and signal strength. It ranges from 1-5% of account balance, adjusted for VIX levels and current drawdown.',
    'what is signal strength': 'Signal Strength is a 0-5 scale that measures the combined strength of technical indicators including moving averages, MACD, RSI, VIX, and ADX. Higher values indicate stronger trading signals.',
    'what is risk level': 'Risk Level (LOW/MEDIUM/HIGH) is determined by combining market volatility, trend strength, and technical indicators. It helps adjust position sizing and strategy selection.'
  };

  static async handleQuestion(question: string): Promise<string> {
    // Convert question to lowercase for matching
    const normalizedQuestion = question.toLowerCase().trim();

    // Check for metric-specific questions
    for (const [key, metric] of Object.entries(CLI_METRICS)) {
      if (normalizedQuestion.includes(metric.name.toLowerCase())) {
        return `${metric.name}: ${metric.description}`;
      }
    }

    // Check for common questions
    for (const [key, answer] of Object.entries(this.COMMON_QUESTIONS)) {
      if (normalizedQuestion.includes(key)) {
        return answer;
      }
    }

    // If no specific match found, provide general help
    return this.getGeneralHelp();
  }

  private static getGeneralHelp(): string {
    return `You can ask questions about:
- Specific metrics (e.g., "What is Probability of Profit?")
- Strategy concepts (e.g., "How is position size calculated?")
- Risk management (e.g., "What is risk level?")
- Technical indicators (e.g., "What is signal strength?")

Try asking about any metric you see in the strategy recommendation, or ask about general concepts like "What is the difference between Probability of Profit and Expected Win Rate?"`;
  }
} 