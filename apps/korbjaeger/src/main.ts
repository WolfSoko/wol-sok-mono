import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { geraeteSpeicher } from './app/geraete-speicher';
import { moveLegacyDeviceKeys } from './app/legacy-device-keys';

// before anything reads a key: the keys before #2966 move to the new ones
moveLegacyDeviceKeys(geraeteSpeicher());

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
