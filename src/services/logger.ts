import { format } from 'date-fns';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = format(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS');
    const dataStr = data ? `\n${JSON.stringify(data, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${dataStr}`;
  }

  debug(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.DEBUG) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, data));
    }
  }

  info(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.INFO) {
      console.info(this.formatMessage(LogLevel.INFO, message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (this.logLevel <= LogLevel.WARN) {
      console.warn(this.formatMessage(LogLevel.WARN, message, data));
    }
  }

  error(message: string, error?: Error, data?: any): void {
    if (this.logLevel <= LogLevel.ERROR) {
      const errorStr = error ? `\n${error.stack}` : '';
      console.error(this.formatMessage(LogLevel.ERROR, message, data) + errorStr);
    }
  }
} 