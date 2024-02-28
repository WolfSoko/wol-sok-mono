import { WebpackConfigOptions } from '@angular-devkit/build-angular/src/utils/build-options';
import { withModuleFederation } from '@nx/angular/module-federation';
import { merge } from 'webpack-merge';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { withVersionHandling } from '../../tools/version-handling/version-webpack.config';
import moduleFederationConfig from './module-federation.config';

export default async (config: WebpackConfigOptions) => {
  const federatedModules = await withModuleFederation(moduleFederationConfig);
  return merge(federatedModules(config), withVersionHandling());
};
