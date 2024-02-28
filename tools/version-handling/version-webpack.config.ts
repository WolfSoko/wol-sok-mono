import { DefinePlugin } from 'webpack';
import latestVersionTag from './latest-version-tag';

export const withVersionHandling = () => ({
  plugins: [
    new DefinePlugin({
      VERSION: `"${latestVersionTag()}"`,
    }),
  ],
});
