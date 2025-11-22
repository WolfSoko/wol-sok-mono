import baseConfig from '../../../eslint.config.mjs';
import baseConfig1 from '../../../eslint.base.config.mjs';

export default [
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
