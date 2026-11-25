/**
 * The two calls the apps make of the SDK, loaded by `import()` in
 * `error-reports.ts`: through this module the bundler keeps only what they
 * need, not the whole package (tracing, Replay and the rest).
 */
export { captureException, init } from '@sentry/angular';
