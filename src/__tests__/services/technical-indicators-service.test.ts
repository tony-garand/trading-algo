import { TechnicalIndicatorsService } from '../../services/technical-indicators-service';

describe('TechnicalIndicatorsService', () => {
  let service: TechnicalIndicatorsService;

  beforeEach(() => {
    service = new TechnicalIndicatorsService();
  });

  describe('calculateSMA', () => {
    it('should calculate SMA correctly for valid data', () => {
      const data = [10, 20, 30, 40, 50];
      const period = 3;
      const result = service.calculateSMA(data, period);
      
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(20); // (10 + 20 + 30) / 3
      expect(result[1]).toBe(30); // (20 + 30 + 40) / 3
      expect(result[2]).toBe(40); // (30 + 40 + 50) / 3
    });

    it('should throw error when not enough data points', () => {
      const data = [10, 20];
      const period = 3;
      
      expect(() => service.calculateSMA(data, period))
        .toThrow('Not enough data points for 3-day SMA calculation');
    });

    it('should handle single value correctly', () => {
      const data = [10];
      const period = 1;
      const result = service.calculateSMA(data, period);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(10);
    });
  });

  describe('calculateMACD', () => {
    it('should calculate MACD correctly', () => {
      const data = Array(30).fill(100).map((v, i) => v + i); // Increasing trend
      const result = service.calculateMACD(data);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      // MACD should be positive for an increasing trend
      expect(result[result.length - 1]).toBeGreaterThan(0);
    });

    it('should handle decreasing trend', () => {
      const data = Array(30).fill(100).map((v, i) => v - i); // Decreasing trend
      const result = service.calculateMACD(data);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      // MACD should be negative for a decreasing trend
      expect(result[result.length - 1]).toBeLessThan(0);
    });
  });

  describe('calculateRSI', () => {
    it('should calculate RSI correctly for overbought condition', () => {
      const data = Array(20).fill(100).map((v, i) => v + i * 2); // Strong uptrend
      const result = service.calculateRSI(data);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      // RSI should be high (>70) for overbought condition
      expect(result[result.length - 1]).toBeGreaterThan(70);
    });

    it('should calculate RSI correctly for oversold condition', () => {
      const data = Array(20).fill(100).map((v, i) => v - i * 2); // Strong downtrend
      const result = service.calculateRSI(data);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      // RSI should be low (<30) for oversold condition
      expect(result[result.length - 1]).toBeLessThan(30);
    });

    it('should handle custom period', () => {
      const data = Array(20).fill(100).map((v, i) => v + i);
      const customPeriod = 7;
      const result = service.calculateRSI(data, customPeriod);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('calculateADX', () => {
    it('should calculate ADX correctly for trending market', () => {
      const high = Array(20).fill(100).map((v, i) => v + i * 2);
      const low = Array(20).fill(100).map((v, i) => v + i);
      const close = Array(20).fill(100).map((v, i) => v + i * 1.5);
      
      const result = service.calculateADX(high, low, close);
      
      expect(result).toBeDefined();
      expect(result.adx).toBeGreaterThan(0);
      expect(result.plusDI).toBeGreaterThan(0);
      expect(result.minusDI).toBeGreaterThan(0);
      // ADX should be high (>25) for strong trend
      expect(result.adx).toBeGreaterThan(25);
    });

    it('should calculate ADX correctly for ranging market', () => {
      const high = Array(20).fill(100).map((v, i) => v + Math.sin(i) * 2);
      const low = Array(20).fill(100).map((v, i) => v + Math.sin(i));
      const close = Array(20).fill(100).map((v, i) => v + Math.sin(i) * 1.5);
      
      const result = service.calculateADX(high, low, close);
      
      expect(result).toBeDefined();
      expect(result.adx).toBeGreaterThan(0);
      expect(result.plusDI).toBeGreaterThan(0);
      expect(result.minusDI).toBeGreaterThan(0);
      // ADX should be low (<20) for ranging market
      expect(result.adx).toBeLessThan(20);
    });

    it('should handle custom period', () => {
      const high = Array(20).fill(100).map((v, i) => v + i);
      const low = Array(20).fill(100).map((v, i) => v + i * 0.5);
      const close = Array(20).fill(100).map((v, i) => v + i * 0.75);
      const customPeriod = 7;
      
      const result = service.calculateADX(high, low, close, customPeriod);
      
      expect(result).toBeDefined();
      expect(result.adx).toBeGreaterThan(0);
      expect(result.plusDI).toBeGreaterThan(0);
      expect(result.minusDI).toBeGreaterThan(0);
    });
  });
}); 