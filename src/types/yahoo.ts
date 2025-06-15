export interface OptionsData {
    date: Date;
    underlyingPrice: number;
    strikes: {
        call: { [strike: number]: OptionQuote };
        put: { [strike: number]: OptionQuote };
    };
    ivPercentile: number;
    putCallRatio: number;
}

export interface OptionQuote {
    strike: number;
    lastPrice: number;
    bid: number;
    ask: number;
    volume: number;
    openInterest: number;
    impliedVolatility: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
}

// Yahoo API Option Quote (raw)
export interface YahooOptionQuote {
    percentChange: { raw: number; fmt: string };
    openInterest: { raw: number; fmt: string; longFmt: string };
    strike: { raw: number; fmt: string };
    change: { raw: number; fmt: string };
    inTheMoney: boolean;
    impliedVolatility: { raw: number; fmt: string };
    volume: { raw: number; fmt: string; longFmt: string };
    ask: { raw: number; fmt: string };
    contractSymbol: string;
    lastTradeDate: { raw: number; fmt: string; longFmt: string };
    currency: string;
    expiration: { raw: number; fmt: string; longFmt: string };
    contractSize: string;
    bid: { raw: number; fmt: string };
    lastPrice: { raw: number; fmt: string };
}

// Yahoo API Underlying Quote (raw)
export interface YahooUnderlyingQuote {
    language: string;
    region: string;
    quoteType: string;
    typeDisp: string;
    quoteSourceName: string;
    triggerable: boolean;
    customPriceAlertConfidence: string;
    shortName: string;
    longName: string;
    regularMarketChangePercent: number;
    regularMarketPrice: number;
    exchange: string;
    messageBoardId: string;
    exchangeTimezoneName: string;
    exchangeTimezoneShortName: string;
    gmtOffSetMilliseconds: number;
    market: string;
    esgPopulated: boolean;
    currency: string;
    marketState: string;
    corporateActions: any[];
    postMarketTime: number;
    regularMarketTime: number;
    priceHint: number;
    postMarketChangePercent: number;
    postMarketPrice: number;
    postMarketChange: number;
    regularMarketChange: number;
    regularMarketDayHigh: number;
    regularMarketDayRange: string;
    regularMarketDayLow: number;
    regularMarketVolume: number;
    regularMarketPreviousClose: number;
    bid: number;
    ask: number;
    bidSize: number;
    askSize: number;
    fullExchangeName: string;
    financialCurrency: string;
    regularMarketOpen: number;
    averageDailyVolume3Month: number;
    averageDailyVolume10Day: number;
    fiftyTwoWeekLowChange: number;
    fiftyTwoWeekLowChangePercent: number;
    fiftyTwoWeekRange: string;
    fiftyTwoWeekHighChange: number;
    fiftyTwoWeekHighChangePercent: number;
    fiftyTwoWeekLow: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekChangePercent: number;
    trailingAnnualDividendRate: number;
    trailingPE: number;
    trailingAnnualDividendYield: number;
    dividendYield: number;
    ytdReturn: number;
    trailingThreeMonthReturns: number;
    trailingThreeMonthNavReturns: number;
    netAssets: number;
    epsTrailingTwelveMonths: number;
    sharesOutstanding: number;
    bookValue: number;
    fiftyDayAverage: number;
    fiftyDayAverageChange: number;
    fiftyDayAverageChangePercent: number;
    twoHundredDayAverage: number;
    twoHundredDayAverageChange: number;
    twoHundredDayAverageChangePercent: number;
    netExpenseRatio: number;
    marketCap: number;
    priceToBook: number;
    sourceInterval: number;
    exchangeDataDelayedBy: number;
    tradeable: boolean;
    cryptoTradeable: boolean;
    hasPrePostMarketData: boolean;
    firstTradeDateMilliseconds: number;
    symbol: string;
}

// Yahoo API Options for a single expiration
export interface YahooOptionsForExpiration {
    expirationDate: number;
    hasMiniOptions: boolean;
    calls: YahooOptionQuote[];
    puts: YahooOptionQuote[];
}

// Yahoo API OptionChain Result (parent object)
export interface YahooOptionChainResult {
    underlyingSymbol: string;
    expirationDates: number[];
    strikes: number[];
    hasMiniOptions: boolean;
    quote: YahooUnderlyingQuote;
    options: YahooOptionsForExpiration[];
}

// Processed options format
export interface ProcessedOptions {
    call: { [strike: number]: OptionQuote };
    put: { [strike: number]: OptionQuote };
}

// Yahoo API OptionChain Root Response
export interface YahooOptionChainResponse {
    optionChain: {
        result: YahooOptionChainResult[];
    };
    error: any;
}