import nxPlugin from '@nx/eslint-plugin';
import angular from 'angular-eslint';
import { FlatCompat } from '@eslint/eslintrc';
// @ts-expect-error import error but it works
import js from '@eslint/js';

import baseConfig from '../../eslint.config.mjs';

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  ...baseConfig,
  { files: ['**/*.ts'], processor: angular.processInlineTemplates },
  ...nxPlugin.configs['flat/angular'].map((config) => ({
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
  ...nxPlugin.configs['flat/angular-template'].map((config) => ({
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
        'playwright/no-standalone-expect': 'off',
        'playwright/expect-expect': 'off',
      },
    })),
];
