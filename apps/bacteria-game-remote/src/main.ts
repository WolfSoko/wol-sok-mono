// Standalone runs of this remote need the import map in place before Angular
// is evaluated; inside the host the shell has already initialised federation.
import { initFederation } from '@angular-architects/native-federation';

initFederation()
  .catch((err) => console.error('Failed to initialise native federation:', err))
  .then(() => import('./bootstrap'))
  .catch((err) => console.error('Failed to bootstrap the application:', err));
