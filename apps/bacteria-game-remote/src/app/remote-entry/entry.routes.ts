import { Routes } from '@angular/router';
import {
  FEAT_LAZY_BACTERIA_GAME_ROUTES,
  provideGameCloud,
} from '@wolsok/feat-lazy-bac-game';
import { environment } from '../../environments/environment';

// For the update offer, which loads the game's texts with these routes.
export { I18nService } from '@wolsok/feat-lazy-bac-game';

export const entryRoutes: Routes = [
  {
    path: '',
    // On the route, not in the app config: inside the shell only these
    // routes are loaded.
    providers: [provideGameCloud(environment.gameCloud)],
    children: FEAT_LAZY_BACTERIA_GAME_ROUTES,
  },
];
