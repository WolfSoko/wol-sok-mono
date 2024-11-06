import { DefinePlugin } from 'webpack';
import { latestVersionTag } from './latest-version-tag';

type AppDeployedPrefix = `${'non-cdk' | 'cdk'}-deployed`;

export const withVersionHandling = (appDeployedPrefix: AppDeployedPrefix) => ({
  plugins: [
    new DefinePlugin({
      VERSION: `"${latestVersionTag(appDeployedPrefix)}"`,
    }),
  ],
});
