const baseConfig = require('../../../eslint.config.js');
const baseConfig1 = require('../../../eslint.base.config.js');

module.exports = [
  ...baseConfig,
  ...baseConfig1,
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
];
