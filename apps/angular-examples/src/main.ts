import { setRemoteDefinitions } from '@nx/angular/mf';
import { fetchVersion } from './app/before-bootstrap/fetch-version';
import { environment } from './environments/environment';

const mfFileName = `/assets/module-federation.manifest${
  environment.production ? '.prod' : ''
}.json`;

fetch(mfFileName)
  .then((res) => res.json())
  .then((definitions) => setRemoteDefinitions(definitions))
  .then(() => fetchVersion())
  .then((version) => (environment.version = normalizeVersion(version)))
  .then(() => import('./bootstrap'))
  .catch((err) => console.error(err));

function normalizeVersion(version: string) {
  if (version === 'next') {
    return version;
  }
  if (!version.startsWith('v')) {
    return 'v' + version;
  }
  return version;
}
