import { setRemoteDefinitions } from '@nx/angular/mf';
import { environment } from './environments/environment';

const mfFileName = `module-federation.manifest${
  environment.production ? '.prod' : ''
}.json`;

try {
  const res = await fetch(`/assets/${mfFileName}`);
  const definitions: Record<string, string> = await res.json();
  setRemoteDefinitions(definitions);
  await import('./bootstrap');
} catch (err) {
  console.error(err);
}
