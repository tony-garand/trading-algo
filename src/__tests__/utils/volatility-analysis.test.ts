import { VolatilityAnalysis } from '../../utils/volatility-analysis';

describe('VolatilityAnalysis', () => {
  it('should calculate IV percentile for non-empty data', () => {
    const result = VolatilityAnalysis.calculateIVPercentile(50, [10, 20, 30, 40, 50, 60, 70]);
    expect(result).toBeGreaterThanOrEqual(0);
  });
}); 