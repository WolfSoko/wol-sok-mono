import { init } from '@module-federation/enhanced/runtime';
import { environment } from './environments/environment';

const mfFileName = `module-federation.manifest${
  environment.production ? '.prod' : ''
}.json`;

try {
  const res = await fetch(`/assets/${mfFileName}`);
  const definitions: Array<{ name: string; entry: string }> = await res.json();
  init({ name: 'angular-examples', remotes: definitions });
  await import('./bootstrap');
} catch (err) {
  console.error(err);
}
