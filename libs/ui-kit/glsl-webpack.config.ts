import { Configuration } from 'webpack';

export default {
  module: {
    rules: [
      {
        test: /\.(glsl|vs|fs)$/,
        loader: 'ts-shader-loader',
      },
    ],
  },
} as Configuration;
