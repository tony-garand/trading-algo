export const mockPage = {
  goto: jest.fn(),
  click: jest.fn(),
  waitForSelector: jest.fn(),
  evaluate: jest.fn(),
  on: jest.fn(),
  close: jest.fn()
};

export const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn()
};

export const mockContext = {
  newPage: jest.fn().mockResolvedValue(mockPage)
};

jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue(mockBrowser)
  }
})); 