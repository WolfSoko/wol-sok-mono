// Karma configuration file, see link for more information
// https://karma-runner.github.io/1.0/config/configuration-file.html

const { join } = require('path');
const getBaseKarmaConfig = require('../../karma.conf');
const glslWebpackConfig = require('./glsl-webpack.config');

module.exports = function (config) {
  const baseConfig = getBaseKarmaConfig();

  config.buildWebpack.webpackConfig.module.rules.push(
    ...glslWebpackConfig.module.rules
  );
  config.set({
    ...baseConfig,

    coverageReporter: {
      ...baseConfig.coverageReporter,
      dir: join(__dirname, '../../../coverage/libs/ui-kit'),
    },
    browsers: ['ChromeHeadlessCI'],
    customLaunchers: {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox'],
      },
    },
  });
};
