// Native Federation has to set up the import map before any shared dependency
// is evaluated, so the application is pulled in behind an async boundary.
import { initFederation } from '@angular-architects/native-federation';
import { environment } from './environments/environment';

const manifest = `/assets/federation.manifest${
  environment.production ? '.prod' : ''
}.json`;

initFederation(manifest)
  .catch((err) => console.error('Failed to initialise native federation:', err))
  .then(() => import('./bootstrap'))
  .catch((err) => console.error('Failed to bootstrap the application:', err));
