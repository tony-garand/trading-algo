import { Logger, LogLevel } from '../../core/logger';

describe('Logger', () => {
  let logger: Logger;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = Logger.getInstance();
    consoleSpy = jest.spyOn(console, 'info').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('getInstance', () => {
    it('should return the same instance', () => {
      const instance1 = Logger.getInstance();
      const instance2 = Logger.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('setLogLevel', () => {
    it('should change log level', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      expect(logger['logLevel']).toBe(LogLevel.DEBUG);
    });
  });

  describe('formatMessage', () => {
    it('should format message with timestamp and level', () => {
      const message = 'Test message';
      const formatted = logger['formatMessage'](LogLevel.INFO, message);
      
      expect(formatted).toMatch(/\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}\] INFO: Test message/);
    });

    it('should include data in formatted message', () => {
      const message = 'Test message';
      const data = { key: 'value' };
      const formatted = logger['formatMessage'](LogLevel.INFO, message, data);
      
      expect(formatted).toContain('Test message');
      expect(formatted).toContain('"key": "value"');
    });
  });

  describe('log levels', () => {
    beforeEach(() => {
      jest.spyOn(console, 'debug').mockImplementation();
      jest.spyOn(console, 'info').mockImplementation();
      jest.spyOn(console, 'warn').mockImplementation();
      jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log debug messages when level is DEBUG', () => {
      logger.setLogLevel(LogLevel.DEBUG);
      logger.debug('Debug message');
      expect(console.debug).toHaveBeenCalled();
    });

    it('should not log debug messages when level is INFO', () => {
      logger.setLogLevel(LogLevel.INFO);
      logger.debug('Debug message');
      expect(console.debug).not.toHaveBeenCalled();
    });

    it('should log info messages when level is INFO', () => {
      logger.setLogLevel(LogLevel.INFO);
      logger.info('Info message');
      expect(console.info).toHaveBeenCalled();
    });

    it('should log warn messages when level is WARN', () => {
      logger.setLogLevel(LogLevel.WARN);
      logger.warn('Warning message');
      expect(console.warn).toHaveBeenCalled();
    });

    it('should log error messages when level is ERROR', () => {
      logger.setLogLevel(LogLevel.ERROR);
      logger.error('Error message');
      expect(console.error).toHaveBeenCalled();
    });

    it('should include error stack trace in error logs', () => {
      logger.setLogLevel(LogLevel.ERROR);
      const error = new Error('Test error');
      logger.error('Error message', error);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Test error'));
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error: Test error'));
    });

    it('should include additional data in logs', () => {
      logger.setLogLevel(LogLevel.INFO);
      const data = { key: 'value' };
      logger.info('Info message', data);
      expect(console.info).toHaveBeenCalledWith(expect.stringContaining('"key": "value"'));
    });
  });
}); 