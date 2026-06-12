import type { RazonBacktestState } from "../types/razon";

export const razonBacktestService = {
  getState(): RazonBacktestState {
    return {
      mode: "backtest",
      status: "ready_no_dataset",
      verifiedPerformance: false,
      performanceMessage: "No verified performance yet",
      results: null,
      message:
        "Backtest foundation is available, but no historical dataset has been provided.",
    };
  },
};
