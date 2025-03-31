import { DefinePlugin } from 'webpack';
import { latestVersionTag } from './latest-version-tag';

type AppDeployedPrefix = `${'non-cdk' | 'cdk'}-deployed`;

export const withVersionHandling = (appDeployedPrefix: AppDeployedPrefix) => {
  const versionTag: string = latestVersionTag(appDeployedPrefix);
  console.log('versionTag', versionTag);
  return {
    plugins: [
      new DefinePlugin({
        VERSION: `"${versionTag}"`,
      }),
    ],
  };
};
