import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { devTools } from '@ngneat/elf-devtools';
import { appConfig } from './app/app.config';
import { RemoteEntryComponent } from './app/remote-entry/entry.component';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(RemoteEntryComponent, appConfig)
  .then((appRef) =>
    devTools({
      postTimelineUpdate: () => appRef.tick(),
    })
  )
  .catch((err) => console.error(err));
