/** Bound response latency and reuse in-flight probes to avoid piling up DB work. */
export function createReadinessProbe(check: () => Promise<unknown>, timeoutMs = 2000) {
  let pending: Promise<boolean> | undefined;
  return async (): Promise<boolean> => {
    if (!pending) {
      pending = Promise.resolve().then(check).then(() => true, () => false)
        .finally(() => { pending = undefined; });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        pending,
        new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
}
