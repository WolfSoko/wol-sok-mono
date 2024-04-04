import { Routes } from '@angular/router';
import { Actions } from '@ngneat/effects-ng';
import { devTools } from '@ngneat/elf-devtools';

export const remoteRoutes: Routes = [
  {
    path: '',
    loadChildren: () =>
      import('@wolsok/feat-fourier-analysis').then((m) => m.routes),
    /*    providers: [
      {
        provide: 'ElfDevTools',
        multi: true,
        useFactory: initElfDevTools,
        deps: [Actions],
      },
    ],*/
  },
];
export function initElfDevTools(actions: Actions) {
  return () => {
    devTools({
      name: 'Fourier Analysis Remote App',
      actionsDispatcher: actions,
    });
  };
}
