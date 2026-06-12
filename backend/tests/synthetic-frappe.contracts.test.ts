import { describe, expect, it } from "vitest";
import {
  TARGET_SYNTHETIC_INDICES,
  type SyntheticIndexMarketName,
} from "../src/modules/synthetic-indices";
import {
  FRAPPE_DOLLAR_ANALYSIS_FEATURES,
  FRAPPE_DOLLAR_SAFETY_RULES,
  type FrappeDollarSignalOutput,
} from "../src/modules/frappe-dollar";

describe("Synthetic Indices and FrappeDollar contracts", () => {
  it("lists the Deriv synthetic markets targeted by this phase", () => {
    const names = TARGET_SYNTHETIC_INDICES.map(item => item.name);
    const required: readonly SyntheticIndexMarketName[] = [
      "Boom 500",
      "Boom 1000",
      "Crash 500",
      "Crash 1000",
      "Volatility 10",
      "Volatility 25",
      "Volatility 50",
      "Volatility 75",
      "Volatility 100",
    ];

    expect(names).toEqual(required);
    expect(TARGET_SYNTHETIC_INDICES.every(item => item.defaultRiskProfile === "HIGH" || item.defaultRiskProfile === "EXTREME")).toBe(true);
  });

  it("keeps FrappeDollar analysis and safety contracts analysis-only", () => {
    const output: FrappeDollarSignalOutput = {
      signalType: "VOLATILITY_MOVE",
      direction: "WAIT",
      confidence: 72,
      entryZone: null,
      stopLoss: null,
      takeProfit: null,
      invalidation: null,
      reason: "Mock contract output for unreadable synthetic movement.",
      visualMarker: {
        kind: "IMPULSE_BALL",
        label: "WAIT",
        color: "#f4c86a",
        status: "WAITING",
      },
      journalRequired: true,
      liveAutoExecutionAllowed: false,
    };

    expect(FRAPPE_DOLLAR_ANALYSIS_FEATURES).toContain("candleAcceleration");
    expect(FRAPPE_DOLLAR_ANALYSIS_FEATURES).toContain("falseSignalRisk");
    expect(FRAPPE_DOLLAR_SAFETY_RULES).toContain("No LIVE auto-execution.");
    expect(output.liveAutoExecutionAllowed).toBe(false);
    expect(output.journalRequired).toBe(true);
  });
});
