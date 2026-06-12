export interface ForexConnectorConfig {
  readonly enabled: boolean;
  readonly provider: string | null;
  readonly baseUrl: string | null;
  readonly apiKeyConfigured: boolean;
  readonly apiSecretConfigured: boolean;
}

export interface ForexRawQuote {
  readonly symbol: string;
  readonly bid: number;
  readonly ask: number;
  readonly timestamp: string;
}

export interface ForexRawCandle {
  readonly timestamp: string;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume?: number;
}
