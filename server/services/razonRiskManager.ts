import type { RazonRiskState } from "../types/razon";

export const razonRiskManager = {
  getRiskState(): RazonRiskState {
    return {
      mode: "demo",
      automaticTradingAllowed: false,
      mt5Connected: false,
      liveExecutionEnabled: false,
      positions: [],
      rules: [
        {
          id: "manual-review",
          label: "Manual review required",
          status: "enforced",
          description: "RAZON V1 never places orders automatically.",
        },
        {
          id: "no-mt5",
          label: "MT5 connector disabled",
          status: "enforced",
          description: "No broker or MT5 connection is configured in V1.",
        },
        {
          id: "verified-performance",
          label: "Verified performance",
          status: "not_configured",
          description: "No verified performance yet.",
        },
      ],
      verifiedPerformance: false,
      performanceMessage: "No verified performance yet",
    };
  },
};
