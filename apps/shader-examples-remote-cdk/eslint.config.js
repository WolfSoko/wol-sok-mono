const baseConfig = require('../../eslint.config.js');
const baseConfig1 = require('../../eslint.base.config.js');
const eslintPluginCdk = require('eslint-plugin-cdk');

module.exports = [
  ...baseConfig,
  ...baseConfig1,
  { plugins: { cdk: eslintPluginCdk } },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {},
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {},
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {},
  },
  { ignores: ['test-build-path/**'] },
];
