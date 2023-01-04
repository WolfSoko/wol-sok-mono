import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';

@NgModule({
  imports: [
    RouterModule.forChild([
      {
        path: '',
        loadChildren: () => import('@wolsok/feat-fourier-analysis').then((m) => m.routes),
      },
    ]),
  ],
})
export class RemoteEntryModule {}
