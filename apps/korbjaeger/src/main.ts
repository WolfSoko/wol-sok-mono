import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { geraeteSpeicher } from './app/geraete-speicher';
import { dropKeysBeforeEnglishNames } from './app/keys-before-english-names';

// before anything reads a key: the keys of before #2966 go
dropKeysBeforeEnglishNames(geraeteSpeicher());

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
