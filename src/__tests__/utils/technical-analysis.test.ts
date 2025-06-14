import { TechnicalAnalysis } from '../../utils/technical-analysis';
import { MarketData } from '../../types/types';

describe('TechnicalAnalysis', () => {
  describe('calculateSMA', () => {
    it('should calculate SMA correctly', () => {
      const prices = [10, 20, 30, 40, 50];
      expect(TechnicalAnalysis.calculateSMA(prices, 3)).toBe(40); // (30 + 40 + 50) / 3
    });

    it('should return 0 when period is larger than data length', () => {
      const prices = [10, 20];
      expect(TechnicalAnalysis.calculateSMA(prices, 3)).toBe(0);
    });
  });

  describe('calculateMACD', () => {
    it('should calculate MACD correctly', () => {
      const prices = Array(30).fill(100).map((v, i) => v + i); // Linear increasing prices
      const result = TechnicalAnalysis.calculateMACD(prices);
      expect(result.macd).toBeDefined();
      expect(result.signal).toBeDefined();
      expect(result.histogram).toBeDefined();
    });
  });

  describe('calculateRSI', () => {
    it('should calculate RSI correctly for uptrend', () => {
      const prices = [10, 12, 14, 16, 18, 20];
      const rsi = TechnicalAnalysis.calculateRSI(prices, 5);
      expect(rsi).toBeGreaterThan(50); // Should be overbought
    });

    it('should calculate RSI correctly for downtrend', () => {
      const prices = [20, 18, 16, 14, 12, 10];
      const rsi = TechnicalAnalysis.calculateRSI(prices, 5);
      expect(rsi).toBeLessThan(50); // Should be oversold
    });

    it('should return 50 when not enough data', () => {
      const prices = [10, 20];
      expect(TechnicalAnalysis.calculateRSI(prices, 5)).toBe(50);
    });

    it('should return 100 when no losses', () => {
      const prices = [10, 12, 14, 16, 18, 20];
      expect(TechnicalAnalysis.calculateRSI(prices, 5)).toBe(100);
    });
  });

  describe('calculateADX', () => {
    it('should calculate ADX correctly', () => {
      const highPrices = [100, 102, 104, 106, 108];
      const lowPrices = [98, 100, 102, 104, 106];
      const closePrices = [99, 101, 103, 105, 107];
      
      const result = TechnicalAnalysis.calculateADX(highPrices, lowPrices, closePrices, 3);
      expect(result.adx).toBeDefined();
      expect(result.plusDI).toBeDefined();
      expect(result.minusDI).toBeDefined();
    });

    it('should return zeros when not enough data', () => {
      const highPrices = [100, 102];
      const lowPrices = [98, 100];
      const closePrices = [99, 101];
      
      const result = TechnicalAnalysis.calculateADX(highPrices, lowPrices, closePrices, 3);
      expect(result).toEqual({ adx: 0, plusDI: 0, minusDI: 0 });
    });
  });

  describe('interpretADX', () => {
    it('should interpret ADX values correctly', () => {
      expect(TechnicalAnalysis.interpretADX(15)).toEqual({ 
        strength: 'VERY_WEAK', 
        description: 'No trend or very weak trend' 
      });
      expect(TechnicalAnalysis.interpretADX(22)).toEqual({ 
        strength: 'WEAK', 
        description: 'Weak trend' 
      });
      expect(TechnicalAnalysis.interpretADX(35)).toEqual({ 
        strength: 'MODERATE', 
        description: 'Moderate trend' 
      });
      expect(TechnicalAnalysis.interpretADX(60)).toEqual({ 
        strength: 'STRONG', 
        description: 'Strong trend' 
      });
      expect(TechnicalAnalysis.interpretADX(80)).toEqual({ 
        strength: 'VERY_STRONG', 
        description: 'Very strong trend' 
      });
    });
  });

  describe('calculateSignalStrength', () => {
    const mockMarketData: MarketData = {
      price: 100,
      sma50: 95,
      sma200: 90,
      rsi: 50,
      macd: 2,
      adx: 25,
      plusDI: 30,
      minusDI: 20,
      vix: 20,
      ivPercentile: 50,
      volume: 1000000,
      date: new Date()
    };

    it('should calculate bullish signal strength correctly', () => {
      const bullishData = { ...mockMarketData, price: 105, rsi: 65 };
      const strength = TechnicalAnalysis.calculateSignalStrength(bullishData);
      expect(strength).toBeGreaterThan(3);
    });

    it('should calculate bearish signal strength correctly', () => {
      const bearishData = { ...mockMarketData, price: 85, rsi: 35 };
      const strength = TechnicalAnalysis.calculateSignalStrength(bearishData);
      expect(strength).toBeLessThan(3);
    });

    it('should adjust signal strength based on volatility', () => {
      const highVolData = { ...mockMarketData, vix: 40, ivPercentile: 80, price: 100, rsi: 50, plusDI: 25, minusDI: 25 };
      const lowVolData = { ...mockMarketData, vix: 15, ivPercentile: 20, price: 100, rsi: 50, plusDI: 25, minusDI: 25 };
      
      const highVolStrength = TechnicalAnalysis.calculateSignalStrength(highVolData);
      const lowVolStrength = TechnicalAnalysis.calculateSignalStrength(lowVolData);
      
      // In high volatility, signal strength should be reduced by 20%
      expect(highVolStrength).toBeLessThanOrEqual(lowVolStrength);
    });
  });

  describe('determineMarketBias', () => {
    const mockMarketData: MarketData = {
      price: 100,
      sma50: 95,
      sma200: 90,
      rsi: 50,
      macd: 2,
      adx: 25,
      plusDI: 30,
      minusDI: 20,
      vix: 20,
      ivPercentile: 50,
      volume: 1000000,
      date: new Date()
    };

    it('should determine bullish bias correctly', () => {
      const bullishData = { ...mockMarketData, price: 105, rsi: 65, plusDI: 35, minusDI: 15 };
      expect(TechnicalAnalysis.determineMarketBias(bullishData)).toBe('BULLISH');
    });

    it('should determine bearish bias correctly', () => {
      const bearishData = { ...mockMarketData, price: 85, rsi: 35, plusDI: 15, minusDI: 35 };
      expect(TechnicalAnalysis.determineMarketBias(bearishData)).toBe('BEARISH');
    });

    it('should determine neutral bias correctly', () => {
      const neutralData = { 
        ...mockMarketData, 
        price: 100,
        sma50: 100,
        sma200: 100,
        rsi: 50,
        macd: 0,
        plusDI: 25,
        minusDI: 25
      };
      expect(TechnicalAnalysis.determineMarketBias(neutralData)).toBe('NEUTRAL');
    });
  });

  describe('calculateProbabilityOfProfit', () => {
    // Test data
    const baseMarketData: MarketData = {
      price: 603.75,
      vix: 20,
      rsi: 50,
      sma50: 600,
      sma200: 590,
      adx: 25,
      plusDI: 30,
      minusDI: 20,
      macd: 0,
      volume: 1000000,
      date: new Date(),
      ivPercentile: 50,
      marketBreadth: {
        advancing: 2000,
        declining: 1000,
        unchanged: 500
      }
    };

    it('should calculate correct probability for a standard bull put spread', () => {
      const currentPrice = 603.75;
      const sellStrike = 592;  // ~2% OTM
      const buyStrike = 580;   // ~4% OTM
      const sellIV = 0.17329;  // 17.329% IV for short put
      const buyIV = 0.19307;   // 19.307% IV for long put
      const daysToExpiry = 28;

      const probability = TechnicalAnalysis.calculateProbabilityOfProfit(
        currentPrice,
        sellStrike,
        buyStrike,
        sellIV,
        buyIV,
        daysToExpiry,
        baseMarketData
      );

      // For a 2% OTM bull put spread with current parameters
      // Expected probability should be around 20-25%
      expect(probability).toBeGreaterThan(20);
      expect(probability).toBeLessThan(25);
    });

    it('should handle high volatility environment', () => {
      const highVolMarketData: MarketData = {
        ...baseMarketData,
        vix: 35 // High VIX
      };

      const probability = TechnicalAnalysis.calculateProbabilityOfProfit(
        603.75,
        592,
        580,
        0.35, // Higher IV for short put
        0.38, // Higher IV for long put
        28,
        highVolMarketData
      );

      // Higher volatility should result in lower probability
      // For 35% IV on short put, expect around 10-15%
      expect(probability).toBeGreaterThan(10);
      expect(probability).toBeLessThan(15);
    });

    it('should handle low volatility environment', () => {
      const lowVolMarketData: MarketData = {
        ...baseMarketData,
        vix: 12 // Low VIX
      };

      const probability = TechnicalAnalysis.calculateProbabilityOfProfit(
        603.75,
        592,
        580,
        0.12, // Lower IV for short put
        0.14, // Lower IV for long put
        28,
        lowVolMarketData
      );

      // Lower volatility should result in higher probability
      // For 12% IV on short put, expect around 20-25%
      expect(probability).toBeGreaterThan(20);
      expect(probability).toBeLessThan(25);
    });

    it('should handle different time to expiry', () => {
      // Test with 7 days to expiry
      const shortTermProb = TechnicalAnalysis.calculateProbabilityOfProfit(
        603.75,
        592,
        580,
        0.17329,
        0.19307,
        7,
        baseMarketData
      );

      // Test with 45 days to expiry
      const longTermProb = TechnicalAnalysis.calculateProbabilityOfProfit(
        603.75,
        592,
        580,
        0.17329,
        0.19307,
        45,
        baseMarketData
      );

      // Shorter term should have higher probability due to less time for price movement
      expect(shortTermProb).toBeGreaterThan(longTermProb);
    });

    it('should handle different strike distances', () => {
      // Test with wider spread (more OTM)
      const wideSpreadProb = TechnicalAnalysis.calculateProbabilityOfProfit(
        603.75,
        595, // 1.5% OTM
        575, // 4.8% OTM
        0.17329,
        0.19307,
        28,
        baseMarketData
      );

      // Test with tighter spread (less OTM)
      const tightSpreadProb = TechnicalAnalysis.calculateProbabilityOfProfit(
        603.75,
        592, // 2% OTM
        580, // 4% OTM
        0.17329,
        0.19307,
        28,
        baseMarketData
      );

      // More OTM spread should have higher probability
      expect(wideSpreadProb).toBeGreaterThan(tightSpreadProb);
    });

    it('should handle different moneyness levels', () => {
      // Test with more OTM spread
      const otmProb = TechnicalAnalysis.calculateProbabilityOfProfit(
        603.75,
        585, // 3% OTM
        573, // 5% OTM
        0.17329,
        0.19307,
        28,
        baseMarketData
      );

      // Test with less OTM spread
      const itmProb = TechnicalAnalysis.calculateProbabilityOfProfit(
        603.75,
        598, // 1% OTM
        586, // 3% OTM
        0.17329,
        0.19307,
        28,
        baseMarketData
      );

      // More OTM spread should have higher probability
      expect(otmProb).toBeGreaterThan(itmProb);
    });

    it('should handle different IV skews', () => {
      // Test with normal IV skew (higher IV for lower strikes)
      const normalSkewProb = TechnicalAnalysis.calculateProbabilityOfProfit(
        603.75,
        592,
        580,
        0.17329, // Lower IV for sell strike
        0.19307, // Higher IV for buy strike
        28,
        baseMarketData
      );

      // Test with inverted IV skew
      const invertedSkewProb = TechnicalAnalysis.calculateProbabilityOfProfit(
        603.75,
        592,
        580,
        0.19307, // Higher IV for sell strike
        0.17329, // Lower IV for buy strike
        28,
        baseMarketData
      );

      // Normal skew should result in higher probability
      // The difference should be significant but not extreme
      expect(normalSkewProb).toBeGreaterThanOrEqual(invertedSkewProb);
      expect(normalSkewProb - invertedSkewProb).toBeLessThan(5); // Max 5% difference
    });

    it('should match calculator metrics for a specific bull put spread', () => {
      // Test case from calculator
      const currentPrice = 603.75;
      const sellStrike = 592;
      const buyStrike = 580;
      const sellIV = 0.17329; // 17.329%
      const buyIV = 0.19307; // 19.307%
      const daysToExpiry = 28;
      const marketData: MarketData = {
        price: currentPrice,
        sma50: currentPrice,
        sma200: currentPrice,
        macd: 0,
        rsi: 50,
        vix: 18.01, // Current VIX value
        ivPercentile: 50,
        adx: 25,
        plusDI: 20,
        minusDI: 20,
        volume: 1000000,
        date: new Date()
      };

      const probability = TechnicalAnalysis.calculateProbabilityOfProfit(
        currentPrice,
        sellStrike,
        buyStrike,
        sellIV,
        buyIV,
        daysToExpiry,
        marketData
      );
      
      // Calculator shows ~20% probability
      expect(probability).toBeGreaterThan(20);
      expect(probability).toBeLessThan(25);
      
      // Verify other metrics
      const sellPutPrice = TechnicalAnalysis.calculatePutPrice(currentPrice, sellStrike, sellIV, daysToExpiry / 365);
      const buyPutPrice = TechnicalAnalysis.calculatePutPrice(currentPrice, buyStrike, buyIV, daysToExpiry / 365);
      const targetCredit = sellPutPrice - buyPutPrice;
      const breakevenPrice = sellStrike - targetCredit;
      
      // Calculator shows $2.17 credit
      expect(targetCredit).toBeGreaterThan(2.15);
      expect(targetCredit).toBeLessThan(2.20);
      
      // Calculator shows $589.83 breakeven
      expect(breakevenPrice).toBeGreaterThan(589.80);
      expect(breakevenPrice).toBeLessThan(589.85);
    });
  });

  describe('calculatePutPrice', () => {
    it('should calculate put price correctly', () => {
      const price = TechnicalAnalysis.calculatePutPrice(
        100, // currentPrice
        95,  // strikePrice
        0.3, // volatility
        30   // timeToExpiry
      );
      expect(price).toBeGreaterThan(0);
    });
  });

  describe('calculateExpectedWinRate', () => {
    const mockMarketData: MarketData = {
      price: 100,
      sma50: 95,
      sma200: 90,
      rsi: 50,
      macd: 2,
      adx: 25,
      plusDI: 30,
      minusDI: 20,
      vix: 20,
      ivPercentile: 50,
      volume: 1000000,
      date: new Date()
    };

    it('should calculate expected win rate for bull call spread', () => {
      const winRate = TechnicalAnalysis.calculateExpectedWinRate(
        mockMarketData,
        'BULL_CALL_SPREAD',
        30,
        {
          sellStrike: 105,
          buyStrike: 100,
          sellIV: 0.3,
          buyIV: 0.3
        }
      );
      expect(winRate).toBeGreaterThan(0);
      expect(winRate).toBeLessThan(1);
    });

    it('should calculate expected win rate for bear put spread', () => {
      const winRate = TechnicalAnalysis.calculateExpectedWinRate(
        mockMarketData,
        'BEAR_PUT_SPREAD',
        30,
        {
          sellStrike: 95,
          buyStrike: 90,
          sellIV: 0.3,
          buyIV: 0.3
        }
      );
      expect(winRate).toBeGreaterThan(0);
      expect(winRate).toBeLessThan(1);
    });
  });
}); 