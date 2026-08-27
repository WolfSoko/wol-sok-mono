import { registerRemotes } from '@module-federation/enhanced/runtime';
import { environment } from './environments/environment';

const mfFileName = `module-federation.manifest${
  environment.production ? '.prod' : ''
}.json`;

try {
  const res = await fetch(`/assets/${mfFileName}`);
  const definitions: Array<{ name: string; entry: string }> = await res.json();
  // The webpack plugin already initialised the runtime with the remotes from
  // module-federation.config.ts, so re-running init() here throws RUNTIME-010.
  // registerRemotes overrides those entries with the ones for this environment.
  registerRemotes(definitions, { force: true });
} catch (err) {
  console.error('Failed to load module federation manifest:', err);
  console.log(
    'Continuing with app bootstrap without module federation remotes'
  );
}

// Always bootstrap the app, even if module federation fails
await import('./bootstrap');
