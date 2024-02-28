import { latestVersionTag } from './latest-version-tag';
import { DefinePlugin } from 'webpack';

const latestVersionTag = latestVersionTag();
console.log(`Version for build: ${latestVersionTag}`);

export const withVersionHandling = (config, context) => ({
  plugins: [
    new DefinePlugin({
      VERSION: `"${latestVersionTag}"`,
    }),
  ],
});
