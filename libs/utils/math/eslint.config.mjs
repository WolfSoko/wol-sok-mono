import { FlatCompat } from '@eslint/eslintrc';

import baseConfig from '../../../eslint.config.mjs';
import baseConfig1 from '../../../eslint.base.config.mjs';
import js from '@eslint/js';

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Convert import.meta.url to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

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
  ...compat.config({ parser: 'jsonc-eslint-parser' }).map((config) => ({
    ...config,
    files: ['**/*.json'],
    rules: {
      ...config.rules,
      '@nx/dependency-checks': 'error',
    },
  })),
];
