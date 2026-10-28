import { Route } from '@angular/router';
import {
  ADMIN_PATH,
  LEGAL_NOTICE_PATH,
  PRIVACY_POLICY_PATH,
  WATCH_PARAM,
  WATCH_PATH,
} from '@wolsok/feat-lazy-bac-game';
import { environment } from '../environments/environment';

export const appRoutes: Route[] = [
  // Only on the game's own site: the shell loads the entry routes below.
  // The paths are the lib's, which the game's footer links to.
  {
    path: PRIVACY_POLICY_PATH,
    loadComponent: () =>
      import('./privacy/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: LEGAL_NOTICE_PATH,
    loadComponent: () =>
      import('./impressum/impressum.component').then(
        (m) => m.ImpressumComponent
      ),
  },
  // A public replay played back (ADR 0011): outside the entry route that
  // provides the game cloud, so it loads no Firebase and signs nobody in.
  // `noindex` and disallowed in robots.txt; its canonical is the replay's
  // page that publicSite renders, `/replays/{publicId}`.
  {
    path: `${WATCH_PATH}/:${WATCH_PARAM}`,
    data: { noindex: true },
    loadComponent: () =>
      import('./watch/watch-page').then((m) => m.WatchPageComponent),
  },
  // The owner's admin area (ADR 0012): its own lazy chunk, which names
  // the game's project itself. Not in the entry routes, so the shell never
  // sees it; `noindex`, and disallowed in robots.txt. The main menu links
  // to it for the owner.
  {
    path: ADMIN_PATH,
    data: { noindex: true },
    loadChildren: () =>
      import('@wolsok/feat-lazy-bac-wars-admin').then((m) =>
        m.adminRoutes(environment.gameCloud)
      ),
  },
  {
    path: '',
    loadChildren: () =>
      import('./remote-entry/entry.routes').then((m) => m.entryRoutes),
  },
];
