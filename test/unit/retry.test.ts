import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry, RetryableError } from "../../src/retry.js";
import type { FetchResponse } from "../../src/client/interface.js";

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("succeeds immediately when function succeeds", async () => {
    const response: FetchResponse = { status: 200, headers: {}, body: "ok" };
    const fn = async () => response;

    const result = await withRetry(fn);

    expect(result).toBe(response);
  });

  it("retries on 5xx and succeeds on second attempt", async () => {
    const success: FetchResponse = { status: 200, headers: {}, body: "ok" };
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls === 1) {
        throw new RetryableError(500);
      }
      return success;
    };

    const promise = withRetry(fn, { baseDelayMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result).toBe(success);
    expect(calls).toBe(2);
  });

  it("throws after exhausting maxRetries", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new RetryableError(503);
    };

    const promise = withRetry(fn, { maxRetries: 2, baseDelayMs: 100 });
    // Attach a catch handler immediately to prevent unhandled rejection
    const resultPromise = promise.catch((err) => err);
    // Advance through all retry delays: 100ms (attempt 0->1), 200ms (attempt 1->2)
    await vi.advanceTimersByTimeAsync(300);

    const err = await resultPromise;
    expect(err).toBeInstanceOf(RetryableError);
    expect(calls).toBe(3); // initial + 2 retries
  });

  it("uses exponential backoff timing", async () => {
    const callTimes: number[] = [];
    let calls = 0;
    const fn = async () => {
      callTimes.push(Date.now());
      calls++;
      throw new RetryableError(500);
    };

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });
    // Attach catch handler immediately to prevent unhandled rejection
    const resultPromise = promise.catch((err) => err);

    // attempt 0 fires immediately
    // delay before retry 1: 100ms * 2^0 = 100ms
    await vi.advanceTimersByTimeAsync(100);
    // delay before retry 2: 100ms * 2^1 = 200ms
    await vi.advanceTimersByTimeAsync(200);
    // delay before retry 3: 100ms * 2^2 = 400ms
    await vi.advanceTimersByTimeAsync(400);

    const err = await resultPromise;
    expect(err).toBeInstanceOf(RetryableError);
    expect(calls).toBe(4);

    // Verify exponential delays
    const delays = callTimes.map((t, i) => (i > 0 ? t - callTimes[i - 1] : 0));
    expect(delays[1]).toBe(100);  // 100 * 2^0
    expect(delays[2]).toBe(200);  // 100 * 2^1
    expect(delays[3]).toBe(400);  // 100 * 2^2
  });

  it("429 uses Retry-After header for delay", async () => {
    const success: FetchResponse = { status: 200, headers: {}, body: "ok" };
    const callTimes: number[] = [];
    let calls = 0;
    const fn = async () => {
      callTimes.push(Date.now());
      calls++;
      if (calls === 1) {
        throw new RetryableError(429, 5000); // Retry-After: 5 seconds
      }
      return success;
    };

    const promise = withRetry(fn, { baseDelayMs: 100 });
    // Should wait 5000ms (from Retry-After), not 100ms (from baseDelay)
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;

    expect(result).toBe(success);
    expect(calls).toBe(2);
    // The actual delay should be 5000ms, not 100ms
    expect(callTimes[1] - callTimes[0]).toBe(5000);
  });

  it("does NOT retry on 4xx (except 429)", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new RetryableError(403);
    };

    await expect(withRetry(fn, { maxRetries: 3, baseDelayMs: 100 })).rejects.toThrow(
      RetryableError,
    );
    expect(calls).toBe(1); // should NOT retry
  });

  it("retries on network-level errors (TypeError/ECONNRESET)", async () => {
    const success: FetchResponse = { status: 200, headers: {}, body: "ok" };
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls === 1) {
        throw new TypeError("fetch failed");
      }
      if (calls === 2) {
        const err = new Error("connect ECONNRESET") as NodeJS.ErrnoException;
        err.code = "ECONNRESET";
        throw err;
      }
      return success;
    };

    const promise = withRetry(fn, { maxRetries: 3, baseDelayMs: 100 });
    // First retry after 100ms
    await vi.advanceTimersByTimeAsync(100);
    // Second retry after 200ms
    await vi.advanceTimersByTimeAsync(200);
    const result = await promise;

    expect(result).toBe(success);
    expect(calls).toBe(3);
  });
});
