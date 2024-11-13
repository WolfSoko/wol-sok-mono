import { withModuleFederation } from '@nx/angular/module-federation';
import { merge } from 'webpack-merge';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { withVersionHandling } from '../../tools/version-handling/version-webpack.config';
import moduleFederationConfig from './module-federation.config';

export default async (config: object) => {
  const federatedModulesConfig = (
    await withModuleFederation(moduleFederationConfig, {
      dts: false,
    })
  )(config);
  return merge(federatedModulesConfig, withVersionHandling('cdk-deployed'), {
    experiments: {
      topLevelAwait: true,
    },
  });
};
