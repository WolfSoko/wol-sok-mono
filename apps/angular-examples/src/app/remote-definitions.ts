import { registerRemotes } from '@module-federation/enhanced/runtime';
import { environment } from '../environments/environment';

export interface RemoteDefinition {
  name: string;
  entry: string;
}

let registration: Promise<void> | undefined;

/**
 * Registers the Module Federation remotes for the current environment, once.
 *
 * This has to stay lazy. Registering the remotes before
 * `bootstrapApplication()` runs makes every remote container initialise up
 * front, and two or more of them then race to serve the shared
 * `@angular/core` consume, so the page ends up with two live copies of
 * Angular. `provideZonelessChangeDetection()` only overrides the `NgZone`
 * token of its own copy, the bootstrap reads the other one, and Angular falls
 * back to its zone based `NgZone` factory - which throws NG0908 because this
 * app is zoneless and does not load zone.js.
 *
 * Called from the lazy routes instead, the host has already bootstrapped and
 * owns the `@angular/core` entry in the share scope, so the remotes reuse it.
 */
export function registerRemotesOnce(): Promise<void> {
  return (registration ??= loadRemoteDefinitions().then((definitions) => {
    // The webpack plugin already initialised the runtime with the remotes from
    // module-federation.config.ts, so re-running init() here throws
    // RUNTIME-010. registerRemotes overrides those entries with the ones for
    // this environment.
    registerRemotes(definitions, { force: true });
  }));
}

async function loadRemoteDefinitions(): Promise<RemoteDefinition[]> {
  const mfFileName = `module-federation.manifest${
    environment.production ? '.prod' : ''
  }.json`;
  const res = await fetch(`/assets/${mfFileName}`);
  return res.json();
}
