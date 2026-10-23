import { Route } from '@angular/router';
import {
  LEGAL_NOTICE_PATH,
  PRIVACY_POLICY_PATH,
} from '@wolsok/feat-lazy-bac-game';

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
  {
    path: '',
    loadChildren: () =>
      import('./remote-entry/entry.routes').then((m) => m.entryRoutes),
  },
];
