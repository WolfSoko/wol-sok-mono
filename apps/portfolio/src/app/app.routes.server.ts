import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Where the catch-all route's not-found page is prerendered, as
 * `<path>/index.html`; portfolio-cdk serves that file for every miss.
 */
export const NOT_FOUND_PAGE_PATH = '404';

export const serverRoutes: ServerRoute[] = [
  {
    path: '**',
    renderMode: RenderMode.Prerender,
    // Only the catch-all route has a parameter, so only it asks for these.
    getPrerenderParams: async () => [{ '**': NOT_FOUND_PAGE_PATH }],
  },
];
