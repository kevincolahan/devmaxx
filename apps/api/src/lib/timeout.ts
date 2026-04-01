// ─── Shared timeout utilities ────────────────────────────────

export const AGENT_RUN_TIMEOUT_MS = 30_000;   // 30 seconds per agent run
export const BATCH_JOB_TIMEOUT_MS = 300_000;  // 5 minutes for batch endpoints

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`Timeout after ${ms}ms: ${label}`);
    this.name = 'TimeoutError';
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new TimeoutError(label, ms));
    }, ms);

    promise
      .then((val) => { clearTimeout(timer); resolve(val); })
      .catch((err) => { clearTimeout(timer); reject(err); });
  });
}
