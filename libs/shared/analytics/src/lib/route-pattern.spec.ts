import { ActivatedRouteSnapshot, Route } from '@angular/router';
import { routePattern, urlPath } from './route-pattern';

function snapshot(...configs: (Route | null)[]): ActivatedRouteSnapshot {
  const routes = configs.map(
    (routeConfig) =>
      ({ routeConfig, firstChild: null }) as {
        routeConfig: Route | null;
        firstChild: unknown;
      }
  );
  routes.forEach((route, i) => (route.firstChild = routes[i + 1] ?? null));
  return routes[0] as unknown as ActivatedRouteSnapshot;
}

describe('routePattern', () => {
  it('joins the paths of the active routes', () => {
    expect(
      routePattern(snapshot(null, { path: '' }, { path: 'watch/:publicId' }))
    ).toBe('/watch/:publicId');
  });

  it('names the root route /', () => {
    expect(routePattern(snapshot(null, { path: '' }))).toBe('/');
  });

  it('keeps nested patterns', () => {
    expect(
      routePattern(snapshot(null, { path: 'admin' }, { path: 'replays/:id' }))
    ).toBe('/admin/replays/:id');
  });
});

describe('urlPath', () => {
  it.each([
    ['/polls?q=cats', '/polls'],
    ['/#friend=abc', '/'],
    ['/poll/1?x=1#y', '/poll/1'],
    ['/privacy', '/privacy'],
  ])('takes %s to %s', (url, path) => {
    expect(urlPath(url)).toBe(path);
  });
});
