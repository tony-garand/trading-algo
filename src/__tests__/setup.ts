import { ConfigService } from '../config/config';

// Mock the ConfigService
jest.mock('../config/config', () => ({
  ConfigService: {
    getInstance: jest.fn().mockReturnValue({
      getApiConfig: jest.fn().mockReturnValue({
        yahooFinanceApi: 'https://mock-api.example.com',
      }),
      getTechnicalConfig: jest.fn().mockReturnValue({
        smaPeriods: [50, 200],
        rsiPeriod: 14,
      }),
    }),
  },
}));

// Global test timeout
jest.setTimeout(10000);

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Global test utilities
export const mockMarketData = {
  price: 100,
  sma50: 98,
  sma200: 95,
  macd: 2.5,
  rsi: 55,
  vix: 20,
  ivPercentile: 50,
  adx: 25,
  plusDI: 30,
  minusDI: 20,
  volume: 1000000,
  date: new Date(),
  optionsData: {
    expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
    strikes: [90, 95, 100, 105, 110],
    daysToExpiration: 25,
    options: [],
  },
}; 