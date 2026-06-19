import { describe, expect, it } from "vitest";
import { confirmRealExecution } from "../../server/controllers/executionController";
import { getRealismAuditReport } from "../../server/services/realism/realismAuditService";

describe("realism and leakage audit", () => {
  it("audits temporal integrity, latency, friction and production gate without enabling execution", () => {
    const report = getRealismAuditReport();

    expect(report.audit).toBe("REALISM_AND_LEAKAGE");
    expect(report.sampleSize).toBeGreaterThanOrEqual(500);
    expect(report.temporalIntegrity.checked).toBe(report.sampleSize);
    expect(report.temporalIntegrity.violations).toBe(0);
    expect(report.signalLeakage).toBe(0);
    expect(report.executionRealism.delayScenarios.map(item => item.delayMs)).toEqual([50, 100, 300, 1000]);
    expect(report.metrics.realisticSharpe).toBeLessThanOrEqual(report.metrics.idealSharpe);
    expect(report.metrics.realisticPnL).toBeLessThan(report.metrics.idealPnL);
    expect(report.gate.daysObservedOk).toBe(false);
    expect(report.realReadiness).toBe("NOT_READY");
    expect(report.liveExecutionEnabled).toBe(false);
    expect(report.orderPlacementAllowed).toBe(false);
    expect(report.autoExecution).toBe(false);
  });

  it("keeps real confirmation forbidden with HTTP 403", () => {
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
