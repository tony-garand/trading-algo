# Options Strategy Analyzer

Advanced options trading strategy analyzer with dynamic technical analysis, volatility optimization, and intelligent position sizing.

## Overview

This document outlines a systematic options trading strategy that analyzes market conditions and recommends appropriate options strategies based on technical indicators, volatility conditions, and risk management rules.

## Features

- **Dynamic Strategy Switching**: Automatically switches between bull spreads, bear spreads, and iron condors based on market conditions
- **Technical Analysis**: Moving averages, MACD, RSI, VIX, and ADX integration
- **Volatility Optimization**: Uses IV percentile to optimize credit vs debit strategies
- **Risk Management**: Built-in drawdown protection and position sizing limits
- **Backtesting**: Historical performance analysis across different market conditions

## Project Structure

```
src/
├── core/                    # Core application functionality
│   ├── cli/                # Command-line interface
│   └── logger.ts           # Logging system
├── services/               # Core services
│   ├── market-data-service.ts    # Market data fetching and processing
│   ├── options-service.ts        # Options chain analysis
│   ├── technical-indicators-service.ts  # Technical analysis
│   ├── vix-service.ts            # VIX data and analysis
│   └── risk-manager.ts           # Risk management system
├── strategies/             # Trading strategies
│   └── options-strategy-analyzer.ts  # Main strategy implementation
├── types/                  # TypeScript type definitions
│   ├── account.ts         # Account-related types
│   ├── backtest.ts        # Backtesting types
│   ├── market.ts          # Market data types
│   ├── risk.ts            # Risk management types
│   └── strategy.ts        # Strategy-related types
└── utils/                 # Utility functions
    ├── technical-analysis.ts    # Technical analysis utilities
    └── volatility-analysis.ts   # Volatility analysis utilities
```

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/options-strategy-analyzer.git
cd options-strategy-analyzer

# Install dependencies
npm install

# Build the project
npm run build
```

### Available Commands

```bash
# Run the strategy analyzer
npm run dev

# Start the built version
npm run start

# Run backtest analysis
npm run backtest

# Get daily strategy recommendation
npm run strategy

# Build the project
npm run build

# Watch for changes during development
npm run watch

# Clean build artifacts
npm run clean
```

## Account Types

The system supports different account configurations:

- **small**: $10,000 account, 10% max risk per trade
- **medium**: $40,000 account, 12% max risk per trade
- **large**: $100,000 account, 15% max risk per trade
- **stressed**: Account in drawdown, reduced risk parameters

## Strategy Logic

### Technical Analysis

The system uses multiple technical indicators to determine market conditions:

- **Moving Averages**: 50-day and 200-day SMA analysis
- **MACD**: Trend direction and strength
- **RSI**: Overbought/Oversold conditions
- **VIX**: Market volatility assessment
- **ADX**: Trend strength measurement

### Strategy Selection

Based on market conditions, the system recommends:

- **Bull Put Spreads**: In high IV environments with bullish bias
- **Bear Call Spreads**: In high IV environments with bearish bias
- **Bull Call Spreads**: In low IV environments with bullish bias
- **Bear Put Spreads**: In low IV environments with bearish bias
- **Iron Condors**: In neutral market conditions with elevated IV

### Risk Management

- Position sizing based on signal strength (4-15% of account)
- Maximum 2-4 open positions depending on account size
- Drawdown protection with reduced position sizes
- VIX-based risk adjustments

## API Usage

```typescript
import { OptionsStrategyAnalyzer } from './strategies/options-strategy-analyzer';
import { MarketDataService } from './services/market-data-service';
import { RiskManager } from './services/risk-manager';

const accountInfo = {
  balance: 100000,
  maxRiskPerTrade: 0.12,
  maxOpenPositions: 3,
  currentDrawdown: 0
};

const marketDataService = new MarketDataService();
const riskManager = new RiskManager(accountInfo);
const analyzer = new OptionsStrategyAnalyzer(marketDataService, riskManager);

const marketData = await marketDataService.getCurrentMarketData();
const recommendation = analyzer.getCurrentRecommendation(marketData);
console.log(analyzer.getFormattedRecommendation(recommendation));
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Disclaimer

This software is for educational and research purposes only. Trading options involves substantial risk and is not suitable for all investors. Past performance does not guarantee future results. Always consult with a qualified financial advisor before making investment decisions.