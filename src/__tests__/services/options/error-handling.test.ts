import { OptionsService } from '../../../services/options-service';
import { ConfigService } from '../../../config/config';
import { Logger } from '../../../core/logger';

jest.setTimeout(30000); // Increase timeout to 30 seconds

jest.mock('../../../config/config');
jest.mock('../../../core/logger');
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn()
  }
}));

describe('OptionsService Error Handling', () => {
  let optionsService: OptionsService;
  let mockConfig: jest.Mocked<ConfigService>;
  let mockLoggerInstance: jest.Mocked<Logger>;
  let evaluateCallCount = 0;
  let mockContext: any;
  let mockPage: any;
  let mockBrowser: any;
  let responseHandlers: ((response: any) => void)[];

  beforeEach(() => {
    jest.clearAllMocks();
    evaluateCallCount = 0;
    responseHandlers = [];

    mockConfig = {
      getCacheConfig: jest.fn().mockReturnValue({
        enabled: true,
        duration: 60000
      }),
      get: jest.fn().mockImplementation((path: string, defaultValue: any) => {
        if (path === 'options.responseTimeout') return 5000; // Increase timeout for tests
        if (path === 'options.navigationTimeout') return 5000;
        if (path === 'options.clickTimeout') return 5000;
        if (path === 'options.selectorTimeout') return 5000;
        return defaultValue;
      })
    } as any;

    mockLoggerInstance = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      setLogLevel: jest.fn()
    } as any;

    // Setup mock page
    mockPage = {
      on: jest.fn((event, handler) => {
        if (event === 'response') {
          responseHandlers.push(handler);
        }
      }),
      goto: jest.fn().mockResolvedValue(undefined),
      click: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn().mockImplementation(() => {
        evaluateCallCount++;
        return Promise.resolve((Math.floor(Date.now() / 1000)).toString());
      })
    };

    // Setup mock context
    mockContext = {
      newPage: jest.fn().mockResolvedValue(mockPage)
    };

    // Setup mock browser
    mockBrowser = {
      newContext: jest.fn().mockResolvedValue(mockContext),
      close: jest.fn().mockResolvedValue(undefined)
    };

    // Mock chromium.launch
    (require('playwright').chromium.launch as jest.Mock).mockResolvedValue(mockBrowser);

    (Logger.getInstance as jest.Mock).mockReturnValue(mockLoggerInstance);
    (ConfigService.getInstance as jest.Mock).mockReturnValue(mockConfig);

    optionsService = new OptionsService();
  });

  const flushPromises = () => new Promise(resolve => setImmediate(resolve));

  // Helper to wait for response handler registration
  async function waitForResponseHandler() {
    let attempts = 0;
    while (responseHandlers.length === 0 && attempts < 50) {
      await new Promise(res => setTimeout(res, 10));
      attempts++;
    }
  }

  // Helper to simulate response
  async function simulateResponse(response: any) {
    await waitForResponseHandler();
    for (const handler of responseHandlers) {
      await handler({
        url: () => '/v7/finance/options/SPY',
        json: () => Promise.resolve(response)
      });
    }
  }

  describe('Error Handling', () => {
    it('should handle invalid response format', async () => {
      evaluateCallCount = 0;
      const fetchPromise = (optionsService as any).fetchOptionsData();
      await waitForResponseHandler();
      await simulateResponse({ invalid: 'format' });
      await expect(fetchPromise).rejects.toThrow('Invalid Yahoo Finance options data format: Missing optionChain');
    });

    it('should handle empty options array', async () => {
      evaluateCallCount = 0;
      const fetchPromise = (optionsService as any).fetchOptionsData();
      await waitForResponseHandler();
      await simulateResponse({
        optionChain: {
          result: [{
            options: []
          }]
        }
      });
      await expect(fetchPromise).rejects.toThrow('No options data found in response');
    });

    it('should handle response timeout', async () => {
      evaluateCallCount = 0;
      // Do not call responseHandler to simulate timeout
      const fetchPromise = (optionsService as any).fetchOptionsData();
      await expect(fetchPromise).rejects.toThrow('Failed to capture options data response');
    });

    it('should handle browser launch failure', async () => {
      evaluateCallCount = 0;
      (require('playwright').chromium.launch as jest.Mock).mockRejectedValueOnce(new Error('Failed to launch browser'));
      const fetchPromise = (optionsService as any).fetchOptionsData();
      await expect(fetchPromise).rejects.toThrow('Failed to launch browser');
    });

    it('should handle page navigation failure', async () => {
      evaluateCallCount = 0;
      mockPage.goto.mockRejectedValueOnce(new Error('Failed to navigate'));
      const fetchPromise = (optionsService as any).fetchOptionsData();
      await expect(fetchPromise).rejects.toThrow('Failed to navigate');
    });
  });

  describe('Browser cleanup', () => {
    it('should close browser in finally block after error', async () => {
      evaluateCallCount = 0;
      mockPage.goto.mockRejectedValueOnce(new Error('Test error'));
      const fetchPromise = (optionsService as any).fetchOptionsData();
      await expect(fetchPromise).rejects.toThrow('Test error');
      expect(mockBrowser.close).toHaveBeenCalled();
    });

    it('should not retry if retry count >= 3', async () => {
      evaluateCallCount = 0;
      mockPage.goto.mockRejectedValueOnce(new Error('Test error'));
      const fetchPromise = (optionsService as any).fetchOptionsData(3);
      await expect(fetchPromise).rejects.toThrow('Test error');
      expect(mockPage.goto).toHaveBeenCalledTimes(1); // Only called once, no retry
    });
  });
}); 