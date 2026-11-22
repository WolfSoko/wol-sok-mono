import type { Router } from '@angular/router';

/**
 * Takes the hash a link brought out of the address - through the router,
 * which holds it - so a reload or a bookmark does not bring it again.
 */
export async function dropHash(router: Router): Promise<void> {
  await router.navigateByUrl(router.url.split('#')[0], { replaceUrl: true });
}
