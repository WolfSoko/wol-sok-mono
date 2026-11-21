import type { ComponentFixture } from '@angular/core/testing';

/** How long `settleUntil` waits: below Jest's 5 s, so its message shows. */
const SETTLE_LIMIT_MS = 3_000;

/** One macrotask turn, then change detection. */
export async function settleTurn(
  fixture: ComponentFixture<unknown>
): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await fixture.whenStable();
  fixture.detectChanges();
}

/**
 * Settles at least one turn and then until `ready` holds, and fails naming
 * `what` once the limit ran out. The first turn renders, so a check for
 * something gone (a loading bar) does not hold on a page never drawn. For work that finishes on no fixed turn: the compression streams of
 * a replay run on Node's thread pool, and a busy machine slows everything.
 */
export async function settleUntil(
  fixture: ComponentFixture<unknown>,
  ready: () => boolean,
  what: string
): Promise<void> {
  const deadline = Date.now() + SETTLE_LIMIT_MS;
  await settleTurn(fixture);
  while (!ready()) {
    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for ${what}`);
    }
    await settleTurn(fixture);
  }
}
