import { Routes } from '@angular/router';
import { FEAT_LAZY_BACTERIA_GAME_ROUTES } from '@wolsok/feat-lazy-bac-game';

export const entryRoutes: Routes = [
  {
    path: '',
    children: FEAT_LAZY_BACTERIA_GAME_ROUTES,
  },
];
