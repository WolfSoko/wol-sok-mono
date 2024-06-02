/* eslint-disable @nx/enforce-module-boundaries */
import { FlatCompat } from '@eslint/eslintrc';

import js from '@eslint/js';
import baseConfig1 from '../../eslint.base.config.js';
import baseConfig from '../../eslint.config.js';

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  ...baseConfig,
  ...baseConfig1,
  ...compat
    .config({
      extends: [
        'plugin:@nx/angular',
        'plugin:@angular-eslint/template/process-inline-templates',
      ],
    })
    .map((config) => ({
      ...config,
      files: ['**/*.ts'],
      rules: {
        ...config.rules,
        '@angular-eslint/directive-selector': [
          'error',
          {
            type: 'attribute',
            prefix: 'rap',
            style: 'camelCase',
          },
        ],
        '@angular-eslint/component-selector': [
          'error',
          {
            type: 'element',
            prefix: 'rap',
            style: 'kebab-case',
          },
        ],
      },
    })),
  ...compat
    .config({ extends: ['plugin:@nx/angular-template'] })
    .map((config) => ({
      ...config,
      files: ['**/*.html'],
      rules: {
        ...config.rules,
      },
    })),
  ...compat
    .config({ extends: ['plugin:playwright/recommended'] })
    .map((config) => ({
      ...config,
      files: ['e2e/**/*.{ts,js,tsx,jsx}'],
      rules: {
        ...config.rules,
      },
    })),
];
