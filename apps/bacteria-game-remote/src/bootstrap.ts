import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { RemoteEntryComponent } from './app/entry.component';
import {
  reportError,
  startErrorReports,
} from './app/error-reports/error-reports';
import { environment } from './environments/environment';

// Before Angular, so a failing start is reported too; the SDK loads beside
// the start, not before it. Only the game on its own site comes this way:
// the shell loads the exposed routes, never this.
startErrorReports(environment.sentry);

bootstrapApplication(RemoteEntryComponent, appConfig).catch((err) => {
  console.error(err);
  reportError(err);
});
