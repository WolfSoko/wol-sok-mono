import nxEslintPlugin from '@nx/eslint-plugin';
import angular from 'angular-eslint';
import tseslint from 'typescript-eslint';

/**
 * ESLint runs here for the one thing oxlint cannot do: Angular templates.
 *
 * It lints `.html` templates and the inline templates of `.component.ts`
 * files with angular-eslint's template rules, and enforces the component /
 * directive selector prefixes per project. Everything else (TypeScript,
 * module boundaries, ...) is oxlint's job - see `.oxlintrc.json`.
 *
 * Nx infers a `lint-templates` target from this file (`@nx/eslint/plugin` in
 * `nx.json`) for every project that owns a non-ignored `.ts` or `.html` file.
 */

/** Selector prefixes per project: `[directive (camelCase), component (kebab-case)]`. */
const selectorPrefixes = {
  'apps/angular-examples': ['app', 'app'],
  'apps/bacteria-game-remote': ['wolsok', 'wolsok'],
  'apps/fourier-analysis-remote': ['wolsok', 'wolsok'],
  'apps/shader-examples-remote': ['app', 'app'],
  'apps/pacetrainer': ['pace', 'pace'],
  'apps/rollapolla-analog': ['rap', 'rap'],
  'libs/features/api/auth': ['ftApiAuth', 'ft-api-auth'],
  'libs/features/lazy/bacteria-game': ['featLazyBacGame', 'feat-lazy-bac-game'],
  'libs/features/lazy/fourier-analysis': ['lazyFeatFanal', 'lazy-feat-fanal'],
  'libs/features/lazy/gravity-rocks': ['featLazyGravity', 'feat-lazy-gravity'],
  'libs/features/lazy/neural-networks': [
    'featLazyNeuralNetworks',
    'feat-lazy-neural-networks',
  ],
  'libs/features/lazy/poisson': ['lazyFeatPoisson', 'lazy-feat-poisson'],
  'libs/features/lazy/reaction-diffusion': [
    'featLazyReactDiff',
    'feat-lazy-react-diff',
  ],
  'libs/features/lazy/shader-examples': ['lzyFtShadEx', 'lzy-ft-shad-ex'],
  'libs/features/lazy/some-gpu-calculation': [
    'lazyFeatGpuCalc',
    'lazy-feat-gpu-calc',
  ],
  'libs/features/lazy/tensorflow-examples': [
    'featLazyTensor',
    'feat-lazy-tensor',
  ],
  'libs/features/lazy/wasm-test': ['lazyFeatWasmTest', 'lazy-feat-wasm-test'],
  'libs/fib-wasm-api': ['shApiFibWasm', 'sh-api-fib-wasm'],
  'libs/public/ws-thanos': ['wsThanos', 'ws-thanos'],
  'libs/shared/data-access': ['lib', 'lib'],
  'libs/shared/headline-animation': ['lib', 'lib'],
  'libs/ui-kit': ['wsSharedUi', 'ws-shared-ui'],
  'libs/utils/gpu-calc': ['wsUtilsGpuJs', 'ws-utils-gpu-js'],
};

export default [
  {
    // The `eslint-disable` comments in the source address oxlint's rules, so
    // most of them are unused from ESLint's point of view.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
  },
  {
    ignores: [
      // Only `.ts` (inline templates, selectors) and `.html` matter here.
      '**/*.{js,cjs,mjs}',
      'dist/**',
      'distS3/**',
      'coverage/**',
      'tmp/**',
      '.angular/**',
      '.nx/**',
      'storybook-static/**',
      '**/test-build-path/**',
      '**/*__template__',
      // Projects without Angular components or templates: no target inferred.
      'apps/*-cdk/**',
      'apps/nx-aws-cdk-v2-e2e/**',
      'libs/public/nx-aws-cdk-v2/**',
      'libs/public/spa-cdk-stack/**',
      'libs/fib-wasm/**',
      'libs/test-helper/**',
      'libs/utils/decorators/**',
      'libs/utils/math/**',
      'libs/utils/measure-fps/**',
      'libs/utils/operators/**',
      'tools/**',
      '__checks__/**',
    ],
  },
  {
    // Parse TypeScript (syntax only, no type information) so the inline
    // templates can be extracted and the selector rules can run.
    files: ['**/*.ts'],
    languageOptions: { parser: tseslint.parser },
    // `@typescript-eslint` and `@nx` run no rules here (oxlint owns them), but
    // the source carries `eslint-disable` comments naming their rules, and
    // ESLint errors on a disable directive for a rule it cannot resolve.
    plugins: {
      '@angular-eslint': angular.tsPlugin,
      '@typescript-eslint': tseslint.plugin,
      '@nx': nxEslintPlugin,
    },
    processor: angular.processInlineTemplates,
  },
  ...Object.entries(selectorPrefixes).map(
    ([projectRoot, [directive, component]]) => ({
      files: [`${projectRoot}/**/*.ts`],
      rules: {
        '@angular-eslint/directive-selector': [
          'error',
          { type: 'attribute', prefix: directive, style: 'camelCase' },
        ],
        '@angular-eslint/component-selector': [
          'error',
          { type: 'element', prefix: component, style: 'kebab-case' },
        ],
      },
    })
  ),
  ...angular.configs.templateRecommended.map((config) => ({
    ...config,
    files: ['**/*.html'],
  })),
];
