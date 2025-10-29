import { init } from '@module-federation/enhanced/runtime';
import { environment } from './environments/environment';

const mfFileName = `module-federation.manifest${
  environment.production ? '.prod' : ''
}.json`;

try {
  const res = await fetch(`/assets/${mfFileName}`);
  const definitions: Array<{ name: string; entry: string }> = await res.json();
  init({ name: 'angular-examples', remotes: definitions });
} catch (err) {
  console.error('Failed to load module federation manifest:', err);
  console.log(
    'Continuing with app bootstrap without module federation remotes'
  );
}

// Always bootstrap the app, even if module federation fails
await import('./bootstrap');
