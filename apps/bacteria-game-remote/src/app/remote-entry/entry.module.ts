import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    RouterModule.forChild([
      {
        path: '',
        loadChildren: () => import('@wolsok/feat-lazy-bac-game').then((m) => m.FEAT_LAZY_BACTERIA_GAME_ROUTES),
      },
    ]),
  ],
  providers: [],
})
export class RemoteEntryModule {}
