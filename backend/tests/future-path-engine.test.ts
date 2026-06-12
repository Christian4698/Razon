import { describe, expect, it } from "vitest";
import { buildFuturePathEngine, FUTURE_PATH_ENGINE_NAME } from "../src/modules/kalos";

describe("future-path-engine", () => {
  it("builds green, blue and grey future paths without displaying 100 percent", () => {
    const output = buildFuturePathEngine({
      signal: "BUY",
      confidence: 84,
      scenario: "CONTINUE",
      target: 1.184,
      invalidation: 1.162,
      volatility: "NORMAL",
      riskScore: 24,
      dataQuality: "OK",
    });

    expect(output.module).toBe(FUTURE_PATH_ENGINE_NAME);
    expect(output.state).toBe("READY");
    expect(output.paths).toHaveLength(3);
    expect(output.paths.map(path => path.color)).toEqual(["GREEN", "BLUE", "GREY"]);
    expect(output.paths.every(path => path.probability > 0 && path.probability < 100)).toBe(true);
    expect(output.paths.every(path => path.invalidation === 1.162)).toBe(true);
    expect(output.liveExecutionAllowed).toBe(false);
  });

  it("shows WAIT when confidence is below 70", () => {
    const output = buildFuturePathEngine({
      signal: "WAIT",
      confidence: 66,
      scenario: "WAIT",
      target: null,
      invalidation: null,
      volatility: "NORMAL",
      riskScore: 42,
      dataQuality: "OK",
    });

    expect(output.state).toBe("WAIT");
    expect(output.paths[0].objective).toContain("WAIT");
    expect(output.paths.every(path => path.probability < 100)).toBe(true);
  });

  it("shows INCERTAIN when structure conflicts", () => {
    const output = buildFuturePathEngine({
      signal: "WAIT",
      confidence: 81,
      scenario: "CONTINUE",
      target: 1.184,
      invalidation: 1.162,
      volatility: "HIGH",
      riskScore: 52,
      conflict: true,
      dataQuality: "OK",
    });

    expect(output.state).toBe("INCERTAIN");
    expect(output.summary).toContain("INCERTAIN");
  });

  it("shows DATA_LOW before other states when data is weak", () => {
    const output = buildFuturePathEngine({
      signal: "NO_TRADE",
      confidence: 62,
      scenario: "CANCEL",
      target: null,
      invalidation: null,
      volatility: "EXTREME",
      riskScore: 88,
      conflict: true,
      dataQuality: "LOW",
    });

    expect(output.state).toBe("DATA_LOW");
    expect(output.paths.every(path => path.displayState === "DATA_LOW")).toBe(true);
    expect(output.paths.every(path => path.probability < 100)).toBe(true);
  });
});
