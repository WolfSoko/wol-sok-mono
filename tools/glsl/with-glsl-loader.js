const { merge } = require('webpack-merge');

/**
 * Configuration for GLSL loader support as webpack rule.
 *
 * @returns {webpack.Configuration} The final webpack configuration with GLSL support.
 */
const withGlslLoader = {
  module: {
    rules: [
      {
        test: /.(glsl|vs|fs)$/,
        loader: 'ts-shader-loader',
      },
    ],
  },
};

module.exports = withGlslLoader;
