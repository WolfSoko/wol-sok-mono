import {
  APP_INITIALIZER,
  ApplicationRef,
  enableProdMode,
  ViewEncapsulation,
} from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { Actions } from '@ngneat/effects-ng';
import { devTools } from '@ngneat/elf-devtools';

import { AppModule } from './app/app.module';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

platformBrowserDynamic()
  .bootstrapModule(AppModule, {
    providers: [
      {
        provide: APP_INITIALIZER,
        multi: true,
        useFactory: initElfDevTools,
        deps: [Actions],
      },
    ],
    defaultEncapsulation: ViewEncapsulation.Emulated,
  })
  .then((moduleRef) => {
    devTools({
      postTimelineUpdate: () => moduleRef.injector.get(ApplicationRef).tick(),
    });
  })
  .catch((err) => console.error(err));

export function initElfDevTools(actions: Actions) {
  return () => {
    devTools({
      name: 'Fourier Analysis Remote App',
      actionsDispatcher: actions,
    });
  };
}
