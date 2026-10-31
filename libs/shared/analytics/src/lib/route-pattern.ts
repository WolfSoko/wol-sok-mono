import { ActivatedRouteSnapshot } from '@angular/router';

/**
 * The pattern of the active route, `/poll/:pollId`, so page reports group by
 * page and the ids in a URL stay out of them. Query and hash never reach it.
 */
export function routePattern(root: ActivatedRouteSnapshot): string {
  const segments: string[] = [];
  for (
    let route: ActivatedRouteSnapshot | null = root;
    route;
    route = route.firstChild
  ) {
    const path = route.routeConfig?.path;
    if (path) segments.push(path);
  }
  return `/${segments.join('/')}`;
}

/** The URL's path, without query and hash. */
export function urlPath(url: string): string {
  return url.split(/[?#]/, 1)[0];
}
