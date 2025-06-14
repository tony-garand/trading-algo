import { OptionsStrategyAnalyzer } from '../../strategies/options-strategy-analyzer';
import { MarketDataService } from '../../services/market-data-service';
import { RiskManager } from '../../services/risk-manager';
import { MarketData } from '../../types/types';
import { AccountInfo } from '../../types/account';
import { OptionsService } from '../../services/options-service';
import { mockOptionsService, baseMockOptionsData, createMockOptionsData } from '../__mocks__/options-service.mock';

jest.mock('../../services/options-service', () => {
  return {
    OptionsService: jest.fn().mockImplementation(() => mockOptionsService)
  };
});

describe('OptionsStrategyAnalyzer', () => {
  let analyzer: OptionsStrategyAnalyzer;
  let mockMarketDataService: jest.Mocked<MarketDataService>;
  let mockRiskManager: jest.Mocked<RiskManager>;
  let realOptionsService: OptionsService;

  const mockMarketData: MarketData = {
    price: 100,
    sma50: 95,
    sma200: 90,
    macd: 2,
    rsi: 50,
    vix: 20,
    ivPercentile: 50,
    adx: 25,
    plusDI: 30,
    minusDI: 20,
    volume: 1000000,
    date: new Date(),
    marketBreadth: {
      advancing: 2000,
      declining: 1000,
      unchanged: 500
    }
  };

  const mockAccountInfo: AccountInfo = {
    type: 'MEDIUM',
    balance: 100000,
    maxRiskPerTrade: 0.12,
    maxOpenPositions: 3,
    currentDrawdown: 0
  };

  beforeAll(() => {
    jest.spyOn(MarketDataService.prototype, 'fetchCurrentMarketData').mockImplementation(function () {
      return Promise.resolve(mockMarketData);
    });
  });

  beforeEach(() => {
    mockMarketDataService = {
      fetchCurrentMarketData: jest.fn().mockResolvedValue(mockMarketData)
    } as any;

    mockRiskManager = {
      calculateRiskMetrics: jest.fn().mockReturnValue({
        maxPositionSize: 10000,
        suggestedStopLoss: 95,
        riskRewardRatio: 2,
        maxDrawdown: 0.15,
        volatilityAdjustment: 1,
        correlationRisk: 0.5,
        maxRisk: 10000,
        stopLoss: 95,
        profitTarget: 110
      })
    } as any;

    realOptionsService = new OptionsService();
    realOptionsService.getOptionsDataForDaysToExpiry = mockOptionsService.getOptionsDataForDaysToExpiry;

    analyzer = new OptionsStrategyAnalyzer(
      mockAccountInfo,
      mockMarketDataService,
      realOptionsService
    );
  });

  describe('Strategy Selection', () => {
    it('should recommend Bull Put Spread in high IV bullish environment', async () => {
      const mockMarketData = {
        price: 100,
        sma50: 95,
        sma200: 90,
        vix: 30,
        ivPercentile: 80,
        rsi: 60,
        macd: 2,
        adx: 25,
        plusDI: 30,
        minusDI: 20,
        volume: 1000000,
        date: new Date()
      };
      mockMarketDataService.fetchCurrentMarketData.mockResolvedValue(mockMarketData);
      mockOptionsService.getOptionsDataForDaysToExpiry.mockResolvedValueOnce(createMockOptionsData({ ivPercentile: 80 }));
      const recommendation = await analyzer.getCurrentRecommendation();
      expect(recommendation.strategy).toBe('BULL_PUT_SPREAD');
      expect(recommendation.riskLevel).toBe('HIGH');
      expect(recommendation.signalStrength).toBeGreaterThan(0.7);
      expect(recommendation.reasoning).toContain('high IV');
    });
    it('should recommend Bear Call Spread in high IV bearish environment', async () => {
      const mockMarketData = {
        price: 100,
        sma50: 105,
        sma200: 110,
        vix: 30,
        ivPercentile: 80,
        rsi: 40,
        macd: -2,
        adx: 25,
        plusDI: 20,
        minusDI: 30,
        volume: 1000000,
        date: new Date()
      };
      mockMarketDataService.fetchCurrentMarketData.mockResolvedValue(mockMarketData);
      mockOptionsService.getOptionsDataForDaysToExpiry.mockResolvedValueOnce(createMockOptionsData({ ivPercentile: 80 }));
      const recommendation = await analyzer.getCurrentRecommendation();
      expect(recommendation.strategy).toBe('BEAR_CALL_SPREAD');
      expect(recommendation.riskLevel).toBe('HIGH');
      expect(recommendation.signalStrength).toBeGreaterThan(0.7);
      expect(recommendation.reasoning).toContain('high IV');
    });
    it('should recommend Bull Call Spread in low IV bullish environment', async () => {
      const mockMarketData = {
        price: 100,
        sma50: 95,
        sma200: 90,
        vix: 15,
        ivPercentile: 10,
        rsi: 60,
        macd: 2,
        adx: 25,
        plusDI: 30,
        minusDI: 20,
        volume: 1000000,
        date: new Date()
      };
      mockMarketDataService.fetchCurrentMarketData.mockResolvedValue(mockMarketData);
      mockOptionsService.getOptionsDataForDaysToExpiry.mockResolvedValueOnce(createMockOptionsData({ ivPercentile: 10 }));
      const recommendation = await analyzer.getCurrentRecommendation();
      expect(recommendation.strategy).toBe('BULL_CALL_SPREAD');
      expect(recommendation.riskLevel).toBe('LOW');
      expect(recommendation.signalStrength).toBeGreaterThan(0.5);
    });
    it('should recommend Bear Put Spread in low IV bearish environment', async () => {
      const mockMarketData = {
        price: 100,
        sma50: 105,
        sma200: 110,
        vix: 15,
        ivPercentile: 10,
        rsi: 40,
        macd: -2,
        adx: 25,
        plusDI: 20,
        minusDI: 30,
        volume: 1000000,
        date: new Date()
      };
      mockMarketDataService.fetchCurrentMarketData.mockResolvedValue(mockMarketData);
      mockOptionsService.getOptionsDataForDaysToExpiry.mockResolvedValueOnce(createMockOptionsData({ ivPercentile: 10 }));
      const recommendation = await analyzer.getCurrentRecommendation();
      expect(recommendation.strategy).toBe('BEAR_PUT_SPREAD');
      expect(recommendation.riskLevel).toBe('LOW');
      expect(recommendation.signalStrength).toBeGreaterThan(0.5);
    });
    it('should recommend Iron Condor in high IV neutral environment', async () => {
      const mockMarketData = {
        price: 100,
        sma50: 100,
        sma200: 100,
        vix: 30,
        ivPercentile: 80,
        rsi: 50,
        macd: 0,
        adx: 15,
        plusDI: 25,
        minusDI: 25,
        volume: 1000000,
        date: new Date()
      };
      mockMarketDataService.fetchCurrentMarketData.mockResolvedValue(mockMarketData);
      mockOptionsService.getOptionsDataForDaysToExpiry.mockResolvedValueOnce(createMockOptionsData({ ivPercentile: 80 }));
      const recommendation = await analyzer.getCurrentRecommendation();
      expect(recommendation.strategy).toBe('IRON_CONDOR');
      expect(recommendation.riskLevel).toBe('HIGH');
      expect(recommendation.signalStrength).toBeGreaterThan(0.5);
      expect(recommendation.reasoning).toContain('high IV');
    });
    it('should recommend no trade in low IV environment', async () => {
      const mockMarketData = {
        price: 100,
        sma50: 100,
        sma200: 100,
        vix: 15,
        ivPercentile: 20,
        rsi: 50,
        macd: 0,
        adx: 15,
        plusDI: 25,
        minusDI: 25,
        volume: 1000000,
        date: new Date()
      };
      mockMarketDataService.fetchCurrentMarketData.mockResolvedValue(mockMarketData);
      mockOptionsService.getOptionsDataForDaysToExpiry.mockResolvedValueOnce(createMockOptionsData({ ivPercentile: 20 }));
      const recommendation = await analyzer.getCurrentRecommendation();
      expect(recommendation.strategy).toBe('NO_TRADE');
      expect(recommendation.reasoning).toContain('low IV');
    });
  });

  describe('Account Type Adjustments', () => {
    it('should adjust position size for small account', async () => {
      const smallAccountInfo: AccountInfo = {
        type: 'SMALL',
        balance: 10000,
        maxRiskPerTrade: 0.10,
        maxOpenPositions: 2,
        currentDrawdown: 0
      };

      analyzer = new OptionsStrategyAnalyzer(smallAccountInfo);
      const recommendation = await analyzer.getCurrentRecommendation();

      expect(recommendation.positionSize).toBeLessThanOrEqual(1000); // 10% of account
      expect(recommendation.maxRisk).toBeLessThanOrEqual(1000);
    });

    it('should adjust position size for medium account', async () => {
      const mediumAccountInfo: AccountInfo = {
        type: 'MEDIUM',
        balance: 40000,
        maxRiskPerTrade: 0.12,
        maxOpenPositions: 3,
        currentDrawdown: 0
      };

      analyzer = new OptionsStrategyAnalyzer(mediumAccountInfo);
      const recommendation = await analyzer.getCurrentRecommendation();

      expect(recommendation.positionSize).toBeLessThanOrEqual(4800); // 12% of account
      expect(recommendation.maxRisk).toBeLessThanOrEqual(4800);
    });

    it('should adjust position size for large account', async () => {
      const largeAccountInfo: AccountInfo = {
        type: 'LARGE',
        balance: 100000,
        maxRiskPerTrade: 0.15,
        maxOpenPositions: 4,
        currentDrawdown: 0
      };

      analyzer = new OptionsStrategyAnalyzer(largeAccountInfo);
      const recommendation = await analyzer.getCurrentRecommendation();

      expect(recommendation.positionSize).toBeLessThanOrEqual(15000); // 15% of account
      expect(recommendation.maxRisk).toBeLessThanOrEqual(15000);
    });

    it('should reduce risk in stressed account', async () => {
      const stressedAccountInfo: AccountInfo = {
        type: 'STRESSED',
        balance: 100000,
        maxRiskPerTrade: 0.08,
        maxOpenPositions: 2,
        currentDrawdown: 0.15
      };

      analyzer = new OptionsStrategyAnalyzer(stressedAccountInfo);
      const recommendation = await analyzer.getCurrentRecommendation();

      expect(recommendation.positionSize).toBeLessThanOrEqual(8000); // 8% of account
      expect(recommendation.maxRisk).toBeLessThanOrEqual(8000);
    });
  });

  describe('Technical Analysis Integration', () => {
    it('should detect bullish trend with high IV for put spread', async () => {
      const bullishData = {
        ...mockMarketData,
        sma50: 105,
        sma200: 100,
        macd: 5,
        rsi: 60,
        vix: 30,
        ivPercentile: 80
      };
      mockMarketDataService.fetchCurrentMarketData.mockResolvedValueOnce(bullishData);
      mockOptionsService.getOptionsDataForDaysToExpiry.mockResolvedValueOnce(createMockOptionsData({ ivPercentile: 80 }));
      const recommendation = await analyzer.getCurrentRecommendation();
      expect(recommendation.strategy).toBe('BULL_PUT_SPREAD');
      expect(recommendation.signalStrength).toBeGreaterThan(0.7);
      expect(recommendation.reasoning).toContain('high IV');
    });
    it('should detect bearish trend with high IV for call spread', async () => {
      const bearishData = {
        ...mockMarketData,
        sma50: 95,
        sma200: 100,
        macd: -5,
        rsi: 40,
        vix: 30,
        ivPercentile: 80
      };
      mockMarketDataService.fetchCurrentMarketData.mockResolvedValueOnce(bearishData);
      mockOptionsService.getOptionsDataForDaysToExpiry.mockResolvedValueOnce(createMockOptionsData({ ivPercentile: 80 }));
      const recommendation = await analyzer.getCurrentRecommendation();
      expect(recommendation.strategy).toBe('BEAR_CALL_SPREAD');
      expect(recommendation.signalStrength).toBeGreaterThan(0.7);
      expect(recommendation.reasoning).toContain('high IV');
    });
    it('should detect overbought conditions with high IV for call spread', async () => {
      const overboughtData = {
        ...mockMarketData,
        rsi: 80,
        macd: 10,
        vix: 30,
        ivPercentile: 80
      };
      mockMarketDataService.fetchCurrentMarketData.mockResolvedValueOnce(overboughtData);
      mockOptionsService.getOptionsDataForDaysToExpiry.mockResolvedValueOnce(createMockOptionsData({ ivPercentile: 80 }));
      const recommendation = await analyzer.getCurrentRecommendation();
      expect(recommendation.strategy).toBe('BEAR_CALL_SPREAD');
      expect(recommendation.signalStrength).toBeGreaterThan(0.7);
      expect(recommendation.reasoning).toContain('high IV');
    });
    it('should detect oversold conditions with high IV for put spread', async () => {
      const oversoldData = {
        ...mockMarketData,
        rsi: 20,
        macd: -10,
        vix: 30,
        ivPercentile: 80
      };
      mockMarketDataService.fetchCurrentMarketData.mockResolvedValueOnce(oversoldData);
      mockOptionsService.getOptionsDataForDaysToExpiry.mockResolvedValueOnce(createMockOptionsData({ ivPercentile: 80 }));
      const recommendation = await analyzer.getCurrentRecommendation();
      expect(recommendation.strategy).toBe('BULL_PUT_SPREAD');
      expect(recommendation.signalStrength).toBeGreaterThan(0.7);
      expect(recommendation.reasoning).toContain('high IV');
    });
  });

  describe('Risk Management Integration', () => {
    it('should increase position size in high IV environment', async () => {
      const highVolData: MarketData = {
        ...mockMarketData,
        vix: 40,
        ivPercentile: 80
      };

      mockMarketDataService.fetchCurrentMarketData.mockResolvedValueOnce(highVolData);
      mockOptionsService.getOptionsDataForDaysToExpiry.mockResolvedValueOnce(createMockOptionsData({ ivPercentile: 80 }));
      const recommendation = await analyzer.getCurrentRecommendation();

      expect(recommendation.riskLevel).toBe('HIGH');
      expect(recommendation.positionSize).toBeGreaterThan(mockAccountInfo.balance * 0.1);
      expect(recommendation.reasoning).toContain('high IV');
    });

    it('should reduce position size in low IV environment', async () => {
      const lowVolData: MarketData = {
        ...mockMarketData,
        vix: 15,
        ivPercentile: 20
      };

      mockMarketDataService.fetchCurrentMarketData.mockResolvedValueOnce(lowVolData);
      mockOptionsService.getOptionsDataForDaysToExpiry.mockResolvedValueOnce(createMockOptionsData({ ivPercentile: 20 }));
      const recommendation = await analyzer.getCurrentRecommendation();

      expect(recommendation.riskLevel).toBe('LOW');
      expect(recommendation.positionSize).toBeLessThan(mockAccountInfo.balance * 0.05);
      expect(recommendation.reasoning).toContain('low IV');
    });

    it('should adjust risk parameters in high correlation environment', async () => {
      const highCorrelationData: MarketData = {
        ...mockMarketData,
        adx: 40,
        plusDI: 35,
        minusDI: 5
      };

      mockMarketDataService.fetchCurrentMarketData.mockResolvedValueOnce(highCorrelationData);
      const recommendation = await analyzer.getCurrentRecommendation();

      expect(recommendation.riskLevel).toBe('HIGH');
      expect(recommendation.positionSize).toBeLessThan(mockAccountInfo.balance * 0.08);
    });

    it('should respect maximum drawdown limits', async () => {
      const stressedAccountInfo: AccountInfo = {
        type: 'STRESSED',
        balance: 100000,
        maxRiskPerTrade: 0.08,
        maxOpenPositions: 2,
        currentDrawdown: 0.20
      };

      analyzer = new OptionsStrategyAnalyzer(stressedAccountInfo);
      const recommendation = await analyzer.getCurrentRecommendation();

      expect(recommendation.positionSize).toBeLessThanOrEqual(4000); // 4% of account
      expect(recommendation.maxRisk).toBeLessThanOrEqual(4000);
    });
  });
}); 