import { MarketDataService } from './market-data-service';
import { OptionsStrategyAnalyzer } from '../strategies/options-strategy-analyzer';
import { RiskManager } from './risk-manager';
import { AccountInfo } from '../types/account';

export class Container {
  private static instance: Container;
  private services: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  register<T>(name: string, service: T): void {
    this.services.set(name, service);
  }

  get<T>(name: string): T {
    const service = this.services.get(name);
    if (!service) {
      throw new Error(`Service ${name} not found`);
    }
    return service as T;
  }

  initializeServices(accountInfo: AccountInfo): void {
    // Register core services
    this.register('marketDataService', new MarketDataService());
    this.register('riskManager', new RiskManager());
    
    // Register strategy services
    this.register('strategyAnalyzer', new OptionsStrategyAnalyzer(accountInfo));
  }
} 