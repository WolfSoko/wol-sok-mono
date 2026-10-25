import { Route } from '@angular/router';
import {
  LEGAL_NOTICE_PATH,
  PRIVACY_POLICY_PATH,
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
  // The owner's admin area (ADR 0012): its own lazy chunk, which names
  // the game's project itself. Not in the entry routes, so the shell never
  // sees it; `noindex`, and disallowed in robots.txt.
  {
    path: 'admin',
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
