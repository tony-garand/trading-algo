import { CLI_METRICS, formatMetricValue } from './metrics';
import { StrategyRecommendation } from '../../strategies/options-strategy-analyzer';

export class CLIFormatter {
  static formatRecommendation(recommendation: StrategyRecommendation): string {
    const sections = [
      this.formatHeader(),
      this.formatStrategyMetrics(recommendation),
      this.formatRiskMetrics(recommendation),
      this.formatStrategyParameters(recommendation)
    ];

    return sections.join('\n\n');
  }

  private static formatHeader(): string {
    return 'Options Strategy Recommendation\n' + '='.repeat(30);
  }

  private static formatStrategyMetrics(recommendation: StrategyRecommendation): string {
    const metrics = [
      ['Strategy', recommendation.strategy],
      ['Position Size', formatMetricValue('POSITION_SIZE', recommendation.positionSize)],
      ['Expected Win Rate', formatMetricValue('EXPECTED_WIN_RATE', recommendation.expectedWinRate)],
      ['Risk Level', recommendation.riskLevel],
      ['Signal Strength', `${recommendation.signalStrength}/5`],
      ['Max Risk', formatMetricValue('MAX_RISK', recommendation.maxRisk)]
    ];

    return metrics.map(([key, value]) => `${key}: ${value}`).join('\n');
  }

  private static formatRiskMetrics(recommendation: StrategyRecommendation): string {
    return `Reasoning:\n${recommendation.reasoning}`;
  }

  private static formatStrategyParameters(recommendation: StrategyRecommendation): string {
    const params = recommendation.parameters;
    const metrics = [
      ['Target Credit', formatMetricValue('TARGET_CREDIT', params.targetCredit)],
      ['Max Loss', formatMetricValue('MAX_LOSS', params.maxLoss)],
      ['Days to Expiration', params.daysToExpiration],
      ['Expiry Date', params.expiryDate.toISOString().split('T')[0]],
      ['Breakeven Price', formatMetricValue('BREAKEVEN_PRICE', params.breakevenPrice)],
      ['Probability of Profit', formatMetricValue('PROBABILITY_OF_PROFIT', params.probabilityOfProfit)]
    ];

    if (params.buyStrike) {
      metrics.push(['Buy Strike', formatMetricValue('currency', params.buyStrike)]);
    }
    if (params.sellStrike) {
      metrics.push(['Sell Strike', formatMetricValue('currency', params.sellStrike)]);
    }

    return 'Strategy Parameters:\n' + 
           metrics.map(([key, value]) => `- ${key}: ${value}`).join('\n');
  }
} 