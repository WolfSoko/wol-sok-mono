import { latestVersionTag } from './latest-version-tag';
import { DefinePlugin } from 'webpack';

const version = latestVersionTag();
console.log(`Version for build: ${version}`);

export const withVersionHandling = (config, context) => ({
  plugins: [
    new DefinePlugin({
      VERSION: `"${version}"`,
    }),
  ],
});
