import { describe, expect, it } from "vitest";
import { createDataModeService, visibleDataModeLabels } from "../src/modules/data-mode";

const baseSafety = {
  liveEnabled: false,
  emergencyStopActive: false,
  analysisInProgress: false,
  tradeInProgress: false,
};

const baseConfirmation = {
  stepOneWarningAccepted: true,
  stepTwoSafetyAccepted: true,
  typedPhrase: "JE COMPRENDS",
};

describe("Data Mode Control safety", () => {
  it("applies a confirmed DEMO_DATA to REAL_DATA change while keeping execution off", () => {
    const service = createDataModeService();

    const result = service.requestChange({
      actor: "operator",
      from: "DEMO_DATA",
      to: "REAL_DATA",
      safety: baseSafety,
      confirmation: baseConfirmation,
    });

    expect(result.status).toBe("APPLIED");
    expect(result.state.mode).toBe("REAL_DATA");
    expect(result.state.executionEnabled).toBe(false);
    expect(result.state.visibleLabels).toContain("REAL_DATA");
    expect(result.state.visibleLabels).toContain("LIVE OFF = EXECUTION OFF");
    expect(service.getAuditTrail().some(event => event.eventType === "DATA_MODE_CHANGED")).toBe(true);
  });

  it("blocks when the exact phrase is missing", () => {
    const service = createDataModeService();

    const result = service.requestChange({
      actor: "operator",
      from: "DEMO_DATA",
      to: "REAL_DATA",
      safety: baseSafety,
      confirmation: {
        ...baseConfirmation,
        typedPhrase: "je comprends",
      },
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.state.mode).toBe("DEMO_DATA");
    expect(result.reasons.some(reason => reason.includes("JE COMPRENDS"))).toBe(true);
  });

  it("blocks when analysis or trade workflow is active", () => {
    const service = createDataModeService();

    const result = service.requestChange({
      actor: "operator",
      from: "DEMO_DATA",
      to: "REAL_DATA",
      safety: {
        ...baseSafety,
        analysisInProgress: true,
        tradeInProgress: true,
      },
      confirmation: baseConfirmation,
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.reasons).toContain("Data mode change blocked while analysis is in progress.");
    expect(result.reasons).toContain("Data mode change blocked while trade workflow is in progress.");
  });

  it("blocks when the target mode is already active", () => {
    const service = createDataModeService();

    const result = service.requestChange({
      actor: "operator",
      from: "DEMO_DATA",
      to: "DEMO_DATA",
      safety: baseSafety,
      confirmation: baseConfirmation,
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.reasons).toContain("Target data mode is already active.");
  });

  it("keeps Emergency Stop as the priority blocker", () => {
    const service = createDataModeService();

    const result = service.requestChange({
      actor: "operator",
      from: "DEMO_DATA",
      to: "REAL_DATA",
      safety: {
        ...baseSafety,
        emergencyStopActive: true,
      },
      confirmation: baseConfirmation,
    });

    expect(result.status).toBe("BLOCKED");
    expect(result.reasons[0]).toBe("Emergency Stop is active and has priority.");
  });

  it("keeps DEMO_DATA labels explicit", () => {
    expect(visibleDataModeLabels("DEMO_DATA")).toEqual(["DEMO_DATA", "DEMO_MODE", "MOCK", "NO REAL IMPACT"]);
  });
});
