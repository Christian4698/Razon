type FlushScheduler = (reason: string) => void;

let scheduler: FlushScheduler | null = null;
let suspended = false;

export function setSaasPersistenceScheduler(nextScheduler: FlushScheduler | null) {
  scheduler = nextScheduler;
}

export function suspendSaasPersistenceNotifications<T>(fn: () => T): T {
  suspended = true;
  try {
    return fn();
  } finally {
    suspended = false;
  }
}

export function notifySaasMutation(reason: string) {
  if (suspended) return;
  scheduler?.(reason);
}
