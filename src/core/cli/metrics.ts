/**
 * CLI Metrics Definitions
 * This file contains definitions and descriptions for all metrics displayed in the CLI
 */

export interface MetricDefinition {
  name: string;
  description: string;
  format: string;
  category: 'STRATEGY' | 'RISK' | 'PERFORMANCE' | 'MARKET';
}

export const CLI_METRICS: { [key: string]: MetricDefinition } = {
  STRATEGY: {
    name: 'Strategy',
    description: 'The selected options strategy based on market conditions',
    format: 'string',
    category: 'STRATEGY'
  },
  POSITION_SIZE: {
    name: 'Position Size',
    description: 'Recommended position size based on account balance and risk parameters',
    format: 'currency',
    category: 'RISK'
  },
  EXPECTED_WIN_RATE: {
    name: 'Expected Win Rate',
    description: 'Historical win rate adjusted for current market conditions and technical indicators',
    format: 'percentage',
    category: 'PERFORMANCE'
  },
  RISK_LEVEL: {
    name: 'Risk Level',
    description: 'Overall risk assessment based on market conditions and strategy parameters',
    format: 'string',
    category: 'RISK'
  },
  SIGNAL_STRENGTH: {
    name: 'Signal Strength',
    description: 'Strength of technical signals (0-5 scale)',
    format: 'number',
    category: 'MARKET'
  },
  MAX_RISK: {
    name: 'Max Risk',
    description: 'Maximum potential loss for the trade',
    format: 'currency',
    category: 'RISK'
  },
  PROBABILITY_OF_PROFIT: {
    name: 'Probability of Profit',
    description: 'Theoretical probability of profit at expiration based on option Greeks',
    format: 'percentage',
    category: 'PERFORMANCE'
  },
  TARGET_CREDIT: {
    name: 'Target Credit',
    description: 'Expected credit received for the trade',
    format: 'currency',
    category: 'STRATEGY'
  },
  MAX_LOSS: {
    name: 'Max Loss',
    description: 'Maximum potential loss if the trade moves against us',
    format: 'currency',
    category: 'RISK'
  },
  DAYS_TO_EXPIRATION: {
    name: 'Days to Expiration',
    description: 'Number of days until options expiration',
    format: 'number',
    category: 'STRATEGY'
  },
  BREAKEVEN_PRICE: {
    name: 'Breakeven Price',
    description: 'Price at which the trade neither profits nor loses',
    format: 'currency',
    category: 'STRATEGY'
  }
};

export const getMetricDescription = (metricKey: string): string => {
  return CLI_METRICS[metricKey]?.description || 'No description available';
};

export const formatMetricValue = (metricKey: string, value: any): string => {
  const metric = CLI_METRICS[metricKey];
  if (!metric) return String(value);

  switch (metric.format) {
    case 'currency':
      return `$${value.toFixed(2)}`;
    case 'percentage':
      return `${value.toFixed(1)}%`;
    case 'number':
      return value.toFixed(2);
    default:
      return String(value);
  }
}; 