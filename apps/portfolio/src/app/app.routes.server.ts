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
    // Angular asks this for every route with a parameter, and today only the
    // catch-all has one. A `:param` route added later needs a server route of
    // its own with its own getPrerenderParams, ahead of this one.
    getPrerenderParams: async () => [{ '**': NOT_FOUND_PAGE_PATH }],
  },
];
