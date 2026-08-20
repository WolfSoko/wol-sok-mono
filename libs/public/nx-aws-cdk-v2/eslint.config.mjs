import baseConfig from '../../../eslint.config.mjs';
import jsoncEslintParser from 'jsonc-eslint-parser';

export default [
  ...baseConfig,
  // EJS templates rendered by the application generator - not valid TS/JSON on their own.
  { ignores: ['**/*__template__'] },
  // Validate that generators.json / executors.json point at files that exist and that
  // every schema is valid - catches a broken plugin manifest before publish.
  {
    files: [
      '**/generators.json',
      '**/executors.json',
      '**/migrations.json',
      '**/package.json',
    ],
    languageOptions: { parser: jsoncEslintParser },
    rules: {
      '@nx/nx-plugin-checks': 'error',
    },
  },
];
