import type { Routes } from '@angular/router';
import {
  type GameCloudOptions,
  provideGameCloud,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminGateComponent } from './access/admin-gate.component';
import { adminGuard } from './access/admin.guard';
import { AdminShellComponent } from './admin-shell.component';

/**
 * The admin area's routes (ADR 0012), for `bacteria-game-remote`'s
 * `app.routes.ts` only - never the exposed entry routes, so the shell does
 * not see them. They name the game's project themselves, so the remote's
 * routes import nothing from the game for them.
 *
 * The views match only for the owner (`adminGuard`); anybody else gets the
 * gate, which offers a Google sign-in.
 */
export function adminRoutes(options: GameCloudOptions | null): Routes {
  return [
    {
      path: '',
      providers: [provideGameCloud(options)],
      component: AdminShellComponent,
      children: [
        {
          path: '',
          canMatch: [adminGuard],
          children: [
            {
              path: '',
              pathMatch: 'full',
              loadComponent: () =>
                import('./overview/overview.component').then(
                  (m) => m.OverviewComponent
                ),
            },
          ],
        },
        { path: '**', component: AdminGateComponent },
      ],
    },
  ];
}
