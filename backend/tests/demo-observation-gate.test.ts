import { describe, expect, it } from "vitest";
import { confirmRealExecution } from "../../server/controllers/executionController";
import { getDemoObservationGateReport } from "../../server/services/observation/demoObservationGateService";

describe("14 days demo observation gate", () => {
  it("keeps real preparation locked until 14 days, 3000 signals and realism thresholds pass", () => {
    const report = getDemoObservationGateReport();

    expect(report.gate).toBe("14_DAY_DEMO_OBSERVATION");
    expect(report.daysObserved).toBe(1);
    expect(report.daysRemaining).toBe(13);
    expect(report.minimumSignals).toBe(3000);
    expect(report.observedSignals).toBeGreaterThan(0);
    expect(report.gateStatus).toBe("REAL_PREP_LOCKED");
    expect(report.realReadiness).toBe("NOT_READY");
    expect(report.blockers).toContain("daysObserved below 14");
    expect(report.blockers).toContain("minimumSignals below 3000");
    expect(report.blockers).toContain("simulationBias above 25");
    expect(report.blockers).toContain("REAL_PREP_LOCKED");
    expect(report.incidentSummary.shadowPnlAnomaly).toBeGreaterThanOrEqual(1);
    expect(report.liveExecutionEnabled).toBe(false);
    expect(report.orderPlacementAllowed).toBe(false);
    expect(report.autoExecution).toBe(false);
    expect(report.confirmRealStatus).toBe(403);
  });

  it("keeps confirm-real forbidden with HTTP 403", () => {
    let statusCode = 200;
    let payload: unknown = null;
    const response = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        payload = body;
        return this;
      },
    };

    confirmRealExecution({} as never, response as never);

    expect(statusCode).toBe(403);
    expect(payload).toMatchObject({
      error: "REAL_EXECUTION_LOCKED",
      liveExecutionEnabled: false,
      orderPlacementAllowed: false,
    });
  });
});
