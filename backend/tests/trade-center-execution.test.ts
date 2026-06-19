import { describe, expect, it } from "vitest";
import { confirmRealExecution } from "../../server/controllers/executionController";

describe("trade center execution guards", () => {
  it("keeps real execution locked with HTTP 403", () => {
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
