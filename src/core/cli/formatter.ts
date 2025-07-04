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
      ['Position', recommendation.parameters.position],
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
      ['Max Profit', formatMetricValue('MAX_LOSS', params.maxProfit)],
      ['Max Loss', formatMetricValue('MAX_LOSS', params.maxLoss)],
      ['Risk/Profit Ratio', (params.maxProfit / params.maxLoss).toFixed(2)],
      ['Max Return on Risk', `${params.maxReturnOnRisk.toFixed(1)}%`],
      ['Days to Expiration', params.daysToExpiration],
      ['Expiry Date', params.expiryDate.toISOString().split('T')[0]],
      ['Probability of Profit', formatMetricValue('PROBABILITY_OF_PROFIT', params.probabilityOfProfit)]
    ];

    // Add strike prices based on strategy type
    if (params.strategy === 'IRON_CONDOR') {
      metrics.push(
        ['Put Sell Strike', formatMetricValue('currency', params.putSellStrike)],
        ['Put Buy Strike', formatMetricValue('currency', params.putBuyStrike)],
        ['Call Sell Strike', formatMetricValue('currency', params.callSellStrike)],
        ['Call Buy Strike', formatMetricValue('currency', params.callBuyStrike)],
        ['Breakeven Range', `${formatMetricValue('currency', params.putSellStrike)} - ${formatMetricValue('currency', params.callSellStrike)}`]
      );
    } else {
      if (params.buyStrike) {
        metrics.push(['Buy Strike', formatMetricValue('currency', params.buyStrike)]);
      }
      if (params.sellStrike) {
        metrics.push(['Sell Strike', formatMetricValue('currency', params.sellStrike)]);
      }
      if (params.breakevenPrice) {
        metrics.push(['Breakeven Price', formatMetricValue('BREAKEVEN_PRICE', params.breakevenPrice)]);
      }
    }

    return 'Strategy Parameters:\n' + 
           metrics.map(([key, value]) => `- ${key}: ${value}`).join('\n');
  }
} 