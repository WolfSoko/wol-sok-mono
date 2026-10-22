import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  // Only on the game's own site: the shell loads the entry routes below.
  {
    path: 'privacy',
    loadComponent: () =>
      import('./privacy/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: '',
    loadChildren: () =>
      import('./remote-entry/entry.routes').then((m) => m.entryRoutes),
  },
];
