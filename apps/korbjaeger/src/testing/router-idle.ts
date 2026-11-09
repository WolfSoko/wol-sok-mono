import type { Router } from '@angular/router';

/** Waits until `router` has no navigation running, back and forward included. */
export async function routerIdle(router: Router): Promise<void> {
  do {
    await new Promise((resolve) => setTimeout(resolve));
  } while (router.currentNavigation() !== null);
}
