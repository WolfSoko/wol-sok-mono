import { withModuleFederation } from '@nx/angular/module-federation';
import { merge } from 'webpack-merge';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { withVersionHandling } from '../../tools/version-handling/version-webpack.config';
import moduleFederationConfig from './module-federation.config';

export default async (config: object) => {
  const federatedModules = await withModuleFederation(moduleFederationConfig, {
    dts: false,
  });
  return merge(config, federatedModules, withVersionHandling());
};
