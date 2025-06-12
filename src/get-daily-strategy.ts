import { OptionsStrategyAnalyzer } from './options-strategy-analyzer';
import { SPYDataFetcher } from './spy-data-fetcher';

async function getDailyStrategy() {
    try {
        // Initialize with default account info
        const accountInfo = {
            balance: 40000,
            maxRiskPerTrade: 0.1,
            maxOpenPositions: 1,
            currentDrawdown: 0
        };

        const analyzer = new OptionsStrategyAnalyzer(accountInfo);
        
        // Get current market data
        const marketData = await SPYDataFetcher.fetchCurrentMarketData();
        
        // Get strategy recommendation
        const recommendation = analyzer.getCurrentRecommendation(marketData);
        
        // Print formatted output
        console.log(analyzer.getFormattedRecommendation(recommendation));
    } catch (error) {
        console.error('Error getting daily strategy:', error);
    }
}

// Run the analysis
getDailyStrategy(); 