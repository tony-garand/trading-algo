import { TechnicalAnalysis } from '../technical-analysis';
import { MarketData } from '../../types';

describe('TechnicalAnalysis', () => {
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

      // For a 2% OTM bull put spread with:
      // - Current price: $603.75
      // - Sell strike: $592 (2% OTM)
      // - Buy strike: $580 (4% OTM)
      // - Sell IV: 17.329%
      // - Buy IV: 19.307%
      // - 28 days to expiry
      // Expected probability should be around 70-75%
      expect(probability).toBeGreaterThan(70);
      expect(probability).toBeLessThan(75);
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
      // For 35% IV on short put, expect around 45-55%
      expect(probability).toBeGreaterThan(45);
      expect(probability).toBeLessThan(55);
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
      // For 12% IV on short put, expect around 70-80%
      expect(probability).toBeGreaterThan(70);
      expect(probability).toBeLessThan(80);
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
      expect(normalSkewProb).toBeGreaterThan(invertedSkewProb);
      expect(normalSkewProb - invertedSkewProb).toBeLessThan(20); // Max 20% difference
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
      
      // Calculator shows 72.2% probability
      expect(probability).toBeGreaterThan(70);
      expect(probability).toBeLessThan(75);
      
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
}); 