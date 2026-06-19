import { describe, expect, it } from "vitest";
import { confirmRealExecution } from "../../server/controllers/executionController";
import { getShadowTradingReport } from "../../server/services/shadow/shadowTradingService";

describe("shadow trading validation", () => {
  it("records at least 500 virtual signals and keeps every execution flag disabled", () => {
    const report = getShadowTradingReport();

    expect(report.mode).toBe("SHADOW_TRADING");
    expect(report.signalsObserved).toBeGreaterThanOrEqual(500);
    expect(report.journal.length).toBeGreaterThan(0);
    expect(report.liveExecutionEnabled).toBe(false);
    expect(report.orderPlacementAllowed).toBe(false);
    expect(report.autoExecution).toBe(false);
    expect(report.realReadiness).toBe("NOT_READY");
    expect(report.forbiddenRoutes).toContain("buy");
    expect(report.forbiddenRoutes).toContain("sell");
    expect(report.forbiddenRoutes).toContain("proposal");
    expect(report.forbiddenRoutes).toContain("order");
    expect(report.rules.rollingSharpeOk).toBe(report.rollingSharpe >= 1.5);
    expect(report.rules.drawdownOk).toBe(report.rollingDrawdown <= 8);
    expect(report.rules.signalDecayOk).toBe(report.signalDecay <= 15);
  });

  it("keeps confirm-real locked with HTTP 403 during shadow validation", () => {
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
