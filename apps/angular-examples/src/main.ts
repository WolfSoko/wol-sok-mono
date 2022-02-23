import {enableProdMode} from "@angular/core";
import {platformBrowserDynamic} from "@angular/platform-browser-dynamic";

import {AppModule} from "./app/app.module";
import {environment} from "./environments/environment";
import {enableAkitaProdMode} from "@datorama/akita";

if (environment.production) {
  enableProdMode();
  enableAkitaProdMode();
}

// persistState({exclude: ['performance-test', 'wasm-test', 'input-wave', 'game-state', 'bacteria-player']});
platformBrowserDynamic().bootstrapModule(AppModule)
  .catch(err => console.error(err));

// platformBrowserDynamic().bootstrapModule(AppModule).then(moduleRef => {
//   const applicationRef = moduleRef.injector.get(ApplicationRef);
//   const componentRef = applicationRef.components[0];
//   // allows to run `ng.profiler.timeChangeDetection();`
//   enableDebugTools(componentRef);
// }).catch(err => window['console'].error(err));
