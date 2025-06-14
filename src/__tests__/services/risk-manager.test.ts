import { RiskManager, RiskMetrics } from '../../services/risk-manager';
import { MarketData } from '../../types/types';

describe('RiskManager', () => {
  const mockMarketData: MarketData = {
    price: 100,
    vix: 20,
    sma50: 95,
    sma200: 90,
    macd: 2,
    rsi: 50,
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

  describe('calculateRiskMetrics', () => {
    it('should calculate risk metrics correctly for normal market conditions', () => {
      const accountBalance = 100000;
      const metrics = RiskManager.calculateRiskMetrics(mockMarketData, accountBalance);

      expect(metrics).toBeDefined();
      expect(metrics.maxPositionSize).toBeGreaterThan(0);
      expect(metrics.suggestedStopLoss).toBeLessThan(mockMarketData.price);
      expect(metrics.riskRewardRatio).toBeGreaterThan(1);
      expect(metrics.maxDrawdown).toBeLessThanOrEqual(0.25);
      expect(metrics.volatilityAdjustment).toBeGreaterThan(0);
      expect(metrics.correlationRisk).toBeGreaterThanOrEqual(0);
      expect(metrics.maxRisk).toBeGreaterThan(0);
      expect(metrics.stopLoss).toBeLessThan(mockMarketData.price);
      expect(metrics.profitTarget).toBeGreaterThan(mockMarketData.price);
    });

    it('should adjust metrics for high volatility', () => {
      const highVolMarketData: MarketData = {
        ...mockMarketData,
        vix: 40
      };
      const accountBalance = 100000;
      const metrics = RiskManager.calculateRiskMetrics(highVolMarketData, accountBalance);

      expect(metrics.volatilityAdjustment).toBeLessThan(1);
      expect(metrics.maxPositionSize).toBeLessThan(accountBalance * 0.08);
    });

    it('should adjust metrics for low volatility', () => {
      const lowVolMarketData: MarketData = {
        ...mockMarketData,
        vix: 10
      };
      const accountBalance = 100000;
      const metrics = RiskManager.calculateRiskMetrics(lowVolMarketData, accountBalance);

      expect(metrics.volatilityAdjustment).toBeGreaterThan(1);
      expect(metrics.maxPositionSize).toBeGreaterThan(accountBalance * 0.08);
    });

    it('should handle missing market breadth data', () => {
      const marketDataWithoutBreadth: MarketData = {
        ...mockMarketData,
        marketBreadth: undefined
      };
      const accountBalance = 100000;
      const metrics = RiskManager.calculateRiskMetrics(marketDataWithoutBreadth, accountBalance);

      expect(metrics.volatilityAdjustment).toBeDefined();
      expect(metrics.maxPositionSize).toBeDefined();
    });

    it('should handle missing ADX data', () => {
      const marketDataWithoutADX: MarketData = {
        ...mockMarketData,
        adx: 0 // Using 0 instead of undefined since adx is required
      };
      const accountBalance = 100000;
      const metrics = RiskManager.calculateRiskMetrics(marketDataWithoutADX, accountBalance);

      expect(metrics.riskRewardRatio).toBeDefined();
      expect(metrics.maxDrawdown).toBeDefined();
    });
  });

  describe('validatePositionSize', () => {
    it('should validate position size within limits', () => {
      const accountBalance = 100000;
      const metrics = RiskManager.calculateRiskMetrics(mockMarketData, accountBalance);
      const validPositionSize = metrics.maxPositionSize * 0.5;

      expect(RiskManager.validatePositionSize(validPositionSize, metrics)).toBe(true);
    });

    it('should reject position size exceeding limits', () => {
      const accountBalance = 100000;
      const metrics = RiskManager.calculateRiskMetrics(mockMarketData, accountBalance);
      const invalidPositionSize = metrics.maxPositionSize * 1.5;

      expect(RiskManager.validatePositionSize(invalidPositionSize, metrics)).toBe(false);
    });
  });

  describe('getRiskAdjustedPositionSize', () => {
    it('should return desired size when within limits', () => {
      const accountBalance = 100000;
      const metrics = RiskManager.calculateRiskMetrics(mockMarketData, accountBalance);
      const desiredSize = metrics.maxPositionSize * 0.5;

      expect(RiskManager.getRiskAdjustedPositionSize(desiredSize, metrics)).toBe(desiredSize);
    });

    it('should cap position size at maximum allowed', () => {
      const accountBalance = 100000;
      const metrics = RiskManager.calculateRiskMetrics(mockMarketData, accountBalance);
      const desiredSize = metrics.maxPositionSize * 1.5;

      expect(RiskManager.getRiskAdjustedPositionSize(desiredSize, metrics)).toBe(metrics.maxPositionSize);
    });
  });

  describe('calculateVolatilityAdjustment', () => {
    it('should adjust for high VIX', () => {
      const highVolMarketData: MarketData = {
        ...mockMarketData,
        vix: 40
      };
      const metrics = RiskManager.calculateRiskMetrics(highVolMarketData, 100000);

      expect(metrics.volatilityAdjustment).toBeLessThan(1);
    });

    it('should adjust for low VIX', () => {
      const lowVolMarketData: MarketData = {
        ...mockMarketData,
        vix: 10
      };
      const metrics = RiskManager.calculateRiskMetrics(lowVolMarketData, 100000);

      expect(metrics.volatilityAdjustment).toBeGreaterThan(1);
    });

    it('should respect minimum and maximum bounds', () => {
      const extremeVolMarketData: MarketData = {
        ...mockMarketData,
        vix: 100
      };
      const metrics = RiskManager.calculateRiskMetrics(extremeVolMarketData, 100000);

      expect(metrics.volatilityAdjustment).toBeGreaterThanOrEqual(0.5);
      expect(metrics.volatilityAdjustment).toBeLessThanOrEqual(1.5);
    });
  });

  describe('calculateCorrelationRisk', () => {
    it('should increase with stronger trends', () => {
      const strongTrendMarketData: MarketData = {
        ...mockMarketData,
        price: 120,
        sma50: 100
      };
      const metrics = RiskManager.calculateRiskMetrics(strongTrendMarketData, 100000);

      expect(metrics.correlationRisk).toBeGreaterThan(0);
    });

    it('should be higher with increased volatility', () => {
      const highVolMarketData: MarketData = {
        ...mockMarketData,
        vix: 40
      };
      const metrics = RiskManager.calculateRiskMetrics(highVolMarketData, 100000);

      expect(metrics.correlationRisk).toBeGreaterThan(0);
    });
  });

  describe('calculateStopLoss', () => {
    it('should set stop loss below current price', () => {
      const metrics = RiskManager.calculateRiskMetrics(mockMarketData, 100000);

      expect(metrics.stopLoss).toBeLessThan(mockMarketData.price);
    });

    it('should adjust stop loss based on volatility', () => {
      const highVolMarketData: MarketData = {
        ...mockMarketData,
        vix: 40
      };
      const metrics = RiskManager.calculateRiskMetrics(highVolMarketData, 100000);

      const normalVolMetrics = RiskManager.calculateRiskMetrics(mockMarketData, 100000);
      const highVolStopDistance = mockMarketData.price - metrics.stopLoss;
      const normalVolStopDistance = mockMarketData.price - normalVolMetrics.stopLoss;

      expect(highVolStopDistance).toBeGreaterThan(normalVolStopDistance);
    });
  });

  describe('calculateRiskRewardRatio', () => {
    it('should maintain minimum risk/reward ratio', () => {
      const metrics = RiskManager.calculateRiskMetrics(mockMarketData, 100000);

      expect(metrics.riskRewardRatio).toBeGreaterThan(1);
    });

    it('should adjust ratio based on market conditions', () => {
      const highVolMarketData: MarketData = {
        ...mockMarketData,
        vix: 40
      };
      const metrics = RiskManager.calculateRiskMetrics(highVolMarketData, 100000);

      const normalVolMetrics = RiskManager.calculateRiskMetrics(mockMarketData, 100000);

      expect(metrics.riskRewardRatio).not.toBe(normalVolMetrics.riskRewardRatio);
    });
  });

  describe('calculateMaxDrawdown', () => {
    it('should cap maximum drawdown', () => {
      const extremeVolMarketData: MarketData = {
        ...mockMarketData,
        vix: 100
      };
      const metrics = RiskManager.calculateRiskMetrics(extremeVolMarketData, 100000);

      expect(metrics.maxDrawdown).toBeLessThanOrEqual(0.25);
    });

    it('should adjust drawdown based on trend strength', () => {
      const strongTrendMarketData: MarketData = {
        ...mockMarketData,
        adx: 50
      };
      const metrics = RiskManager.calculateRiskMetrics(strongTrendMarketData, 100000);

      const weakTrendMarketData: MarketData = {
        ...mockMarketData,
        adx: 10
      };
      const weakTrendMetrics = RiskManager.calculateRiskMetrics(weakTrendMarketData, 100000);

      expect(metrics.maxDrawdown).not.toBe(weakTrendMetrics.maxDrawdown);
    });
  });
}); 