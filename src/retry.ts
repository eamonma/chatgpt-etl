export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

export class RetryableError extends Error {
  constructor(
    public readonly status: number,
    public readonly retryAfterMs?: number,
  ) {
    super(`Retryable HTTP error: ${status}`);
    this.name = "RetryableError";
  }
}

function isRetryable(err: unknown): boolean {
  if (err instanceof RetryableError) {
    const { status } = err;
    return status >= 500 || status === 429;
  }
  // Network-level errors (TypeError, ECONNRESET, etc.) are retryable
  return true;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isRetryable(err) || attempt === maxRetries) {
        throw err;
      }

      let delayMs = baseDelayMs * Math.pow(2, attempt);

      if (err instanceof RetryableError && err.retryAfterMs != null) {
        delayMs = err.retryAfterMs;
      }

      await delay(delayMs);
    }
  }

  throw lastError;
}
