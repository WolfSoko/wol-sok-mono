import { withModuleFederation } from '@nx/angular/module-federation';
// eslint-disable-next-line @nx/enforce-module-boundaries
import moduleFederationConfig from './module-federation.config';

export default withModuleFederation(moduleFederationConfig);
