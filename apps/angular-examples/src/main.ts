// Module Federation needs an async boundary before the app touches any shared
// dependency. The remotes are registered lazily by the routes that use them
// (see ./app/remote-definitions.ts) - registering them here, before the app
// bootstraps, leaves the page with two copies of @angular/core.
import('./bootstrap').catch((err) =>
  console.error('Failed to bootstrap the application:', err)
);
