import { describe, expect, it } from "vitest";
import { runOutOfSampleValidation } from "../../server/services/validation/outOfSampleValidation";

describe("out-of-sample validation", () => {
  it("splits train validation test without test recalibration and reports generalization", () => {
    const report = runOutOfSampleValidation();

    expect(report.split.temporalLeakagePrevented).toBe(true);
    expect(report.split.recalibratedOnTest).toBe(false);
    expect(report.train.totalSignals).toBeGreaterThanOrEqual(1000);
    expect(report.validation.totalSignals).toBeGreaterThanOrEqual(1000);
    expect(report.test.totalSignals).toBeGreaterThanOrEqual(1000);
    expect(report.generalizationGap).toBeGreaterThanOrEqual(0);
    expect(["LOW", "MEDIUM", "HIGH", "OVERFIT"]).toContain(report.overfitRisk);
    expect(["LOW", "MEDIUM", "HIGH"]).toContain(report.productionConfidence);
    expect(report.stress).toHaveLength(7);
    expect(report.realReadiness).toBe("NOT_READY");
    expect(report.liveExecutionAllowed).toBe(false);
  });
});
