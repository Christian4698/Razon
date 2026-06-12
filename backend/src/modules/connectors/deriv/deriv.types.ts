export interface DerivConnectorConfig {
  readonly enabled: boolean;
  readonly appId: string | null;
  readonly apiTokenConfigured: boolean;
  readonly endpoint: string;
  readonly accountType: "demo" | "live";
  readonly allowOrderPlacement: boolean;
}

export interface DerivRawTick {
  readonly symbol: string;
  readonly quote: number;
  readonly epoch: number;
}

export interface DerivRawCandle {
  readonly epoch: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
}
