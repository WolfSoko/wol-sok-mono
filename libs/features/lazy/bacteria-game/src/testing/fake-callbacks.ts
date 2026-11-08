/**
 * How the fake SDK parts answer: like the SDK, they tell a new listener
 * its first value asynchronously, never inside the subscribing call. Auth
 * tells a switch of user (`become`, a sign-in or sign-out) at once, as the
 * SDK does before its sign-in call resolves.
 */

/**
 * Runs the callback in a microtask - through a promise, not
 * `queueMicrotask`, which Jest's fake timers hold back.
 */
export function later(callback: () => void): void {
  void Promise.resolve().then(callback);
}

/** Lets the callbacks the fakes queued so far reach their listeners. */
export async function settleSnapshots(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    await Promise.resolve();
  }
}

/** A promise that never settles: a call whose answer never arrives. */
export function never<T>(): Promise<T> {
  return new Promise<T>(() => undefined);
}

/** An error with the code the SDK gives it. */
export function sdkError(code: string): Error {
  return Object.assign(new Error(code), { code });
}
