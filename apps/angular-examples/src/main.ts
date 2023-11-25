import { setRemoteDefinitions } from '@nx/angular/mf';
import { environment } from './environments/environment';

const mfFileName = `module-federation.manifest${
  environment.production ? '.prod' : ''
}.json`;

fetch(`/assets/${mfFileName}`)
  .then((res) => res.json())
  .then((definitions) => setRemoteDefinitions(definitions))
  .then(() => import('./bootstrap').catch((err) => console.error(err)));
