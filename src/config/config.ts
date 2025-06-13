import { LogLevel } from '../core/logger';
import { accountConfigs } from './account-config';

export interface TradingConfig {
  // API Configuration
  api: {
    yahooFinanceApi: string;
    vixApi: string;
    optionsApi: string;
    requestInterval: number;
  };

  // Cache Configuration
  cache: {
    duration: number;
    enabled: boolean;
  };

  // Logging Configuration
  logging: {
    level: LogLevel;
    fileEnabled: boolean;
    consoleEnabled: boolean;
  };

  // Trading Configuration
  trading: {
    minDaysToExpiration: number;
    maxDaysToExpiration: number;
    maxRiskPerTrade: number;
    maxOpenPositions: number;
  };

  // Technical Analysis Configuration
  technical: {
    rsiPeriod: number;
    macdFastPeriod: number;
    macdSlowPeriod: number;
    macdSignalPeriod: number;
    smaPeriods: number[];
  };
}

const defaultConfig: TradingConfig = {
  api: {
    yahooFinanceApi: 'https://query1.finance.yahoo.com/v8/finance/chart/SPY',
    vixApi: 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX',
    optionsApi: 'https://query1.finance.yahoo.com/v7/finance/options/SPY',
    requestInterval: 5000
  },
  cache: {
    duration: 60000,
    enabled: true
  },
  logging: {
    level: LogLevel.INFO,
    fileEnabled: false,
    consoleEnabled: true
  },
  trading: {
    minDaysToExpiration: 20,
    maxDaysToExpiration: 30,
    maxRiskPerTrade: 0.12,
    maxOpenPositions: 3
  },
  technical: {
    rsiPeriod: 14,
    macdFastPeriod: 12,
    macdSlowPeriod: 26,
    macdSignalPeriod: 9,
    smaPeriods: [50, 200]
  }
};

export class ConfigService {
  private static instance: ConfigService;
  private config: TradingConfig;

  private constructor() {
    this.config = { ...defaultConfig };
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  getConfig(): TradingConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<TradingConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }

  getAccountConfig(type: string) {
    return accountConfigs[type];
  }

  getApiConfig() {
    return { ...this.config.api };
  }

  getCacheConfig() {
    return { ...this.config.cache };
  }

  getLoggingConfig() {
    return { ...this.config.logging };
  }

  getTradingConfig() {
    return { ...this.config.trading };
  }

  getTechnicalConfig() {
    return { ...this.config.technical };
  }
} 