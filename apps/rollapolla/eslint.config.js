const { FlatCompat } = require('@eslint/eslintrc');
const baseConfig = require('../../eslint.config.js');
const baseConfig1 = require('../../eslint.base.config.js');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
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
      files: ['e2e/**/*.{ts,tsx,js,jsx}'],
      rules: {
        ...config.rules,
      },
    })),
];
