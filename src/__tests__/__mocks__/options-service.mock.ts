// Mocks for OptionsService and options data for use in tests
import { OptionsData, OptionQuote } from '../../services/options-service';

export const baseMockOptionsData: OptionsData = {
  date: new Date(),
  underlyingPrice: 100,
  strikes: {
    call: {
      95: {
        strike: 95,
        lastPrice: 6.5,
        bid: 6.4,
        ask: 6.6,
        volume: 1000,
        openInterest: 5000,
        impliedVolatility: 0.25,
        delta: 0.75,
        gamma: 0.05,
        theta: -0.1,
        vega: 0.2
      },
      100: {
        strike: 100,
        lastPrice: 3.5,
        bid: 3.4,
        ask: 3.6,
        volume: 2000,
        openInterest: 8000,
        impliedVolatility: 0.22,
        delta: 0.5,
        gamma: 0.06,
        theta: -0.12,
        vega: 0.25
      },
      105: {
        strike: 105,
        lastPrice: 1.5,
        bid: 1.4,
        ask: 1.6,
        volume: 1500,
        openInterest: 6000,
        impliedVolatility: 0.20,
        delta: 0.25,
        gamma: 0.05,
        theta: -0.08,
        vega: 0.18
      }
    },
    put: {
      95: {
        strike: 95,
        lastPrice: 1.5,
        bid: 1.4,
        ask: 1.6,
        volume: 1500,
        openInterest: 6000,
        impliedVolatility: 0.23,
        delta: -0.25,
        gamma: 0.05,
        theta: -0.08,
        vega: 0.18
      },
      100: {
        strike: 100,
        lastPrice: 3.5,
        bid: 3.4,
        ask: 3.6,
        volume: 1800,
        openInterest: 7000,
        impliedVolatility: 0.21,
        delta: -0.5,
        gamma: 0.06,
        theta: -0.11,
        vega: 0.22
      },
      105: {
        strike: 105,
        lastPrice: 6.5,
        bid: 6.4,
        ask: 6.6,
        volume: 1200,
        openInterest: 5000,
        impliedVolatility: 0.24,
        delta: -0.75,
        gamma: 0.05,
        theta: -0.15,
        vega: 0.20
      }
    }
  },
  ivPercentile: 50,
  putCallRatio: 1,
  options: [
    {
      expirationDate: Math.floor(Date.now() / 1000) + 28 * 24 * 60 * 60, // 28 days from now
      hasMiniOptions: false,
      calls: [
        {
          strike: { raw: 95 },
          lastPrice: { raw: 6.5 },
          bid: { raw: 6.4 },
          ask: { raw: 6.6 },
          volume: { raw: 1000 },
          openInterest: { raw: 5000 },
          impliedVolatility: { raw: 0.25 }
        },
        {
          strike: { raw: 100 },
          lastPrice: { raw: 3.5 },
          bid: { raw: 3.4 },
          ask: { raw: 3.6 },
          volume: { raw: 2000 },
          openInterest: { raw: 8000 },
          impliedVolatility: { raw: 0.22 }
        },
        {
          strike: { raw: 105 },
          lastPrice: { raw: 1.5 },
          bid: { raw: 1.4 },
          ask: { raw: 1.6 },
          volume: { raw: 1500 },
          openInterest: { raw: 6000 },
          impliedVolatility: { raw: 0.20 }
        }
      ],
      puts: [
        {
          strike: { raw: 95 },
          lastPrice: { raw: 1.5 },
          bid: { raw: 1.4 },
          ask: { raw: 1.6 },
          volume: { raw: 1500 },
          openInterest: { raw: 6000 },
          impliedVolatility: { raw: 0.23 }
        },
        {
          strike: { raw: 100 },
          lastPrice: { raw: 3.5 },
          bid: { raw: 3.4 },
          ask: { raw: 3.6 },
          volume: { raw: 1800 },
          openInterest: { raw: 7000 },
          impliedVolatility: { raw: 0.21 }
        },
        {
          strike: { raw: 105 },
          lastPrice: { raw: 6.5 },
          bid: { raw: 6.4 },
          ask: { raw: 6.6 },
          volume: { raw: 1200 },
          openInterest: { raw: 5000 },
          impliedVolatility: { raw: 0.24 }
        }
      ]
    }
  ]
};

export function createMockOptionsData(overrides: Partial<OptionsData> = {}): OptionsData {
  return {
    ...baseMockOptionsData,
    ...overrides,
    strikes: {
      call: { ...baseMockOptionsData.strikes.call, ...(overrides.strikes?.call || {}) },
      put: { ...baseMockOptionsData.strikes.put, ...(overrides.strikes?.put || {}) },
    },
    options: overrides.options || baseMockOptionsData.options,
  };
}

export const mockOptionsService = {
  getOptionsDataForDaysToExpiry: jest.fn().mockResolvedValue(baseMockOptionsData),
  calculatePutCallRatio: jest.fn().mockReturnValue(1),
  processOptions: jest.fn().mockReturnValue(baseMockOptionsData.strikes)
}; 