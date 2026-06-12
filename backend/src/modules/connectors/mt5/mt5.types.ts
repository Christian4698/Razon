export interface Mt5ConnectorConfig {
  readonly enabled: boolean;
  readonly login: string | null;
  readonly passwordConfigured: boolean;
  readonly server: string | null;
  readonly accountType: "demo" | "live";
  readonly bridgeHost: string;
  readonly bridgePort: number;
  readonly terminalPath: string | null;
  readonly allowOrderPlacement: boolean;
}

export interface Mt5RawAccountInfo {
  readonly login: string;
  readonly server: string;
  readonly currency?: string;
  readonly balance?: number;
  readonly equity?: number;
  readonly margin?: number;
  readonly freeMargin?: number;
}

export interface Mt5RawCandle {
  readonly time: string | number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly tick_volume?: number;
  readonly spread?: number;
}
