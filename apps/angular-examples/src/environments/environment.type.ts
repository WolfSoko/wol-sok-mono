import type { FirebaseOptions } from '@wolsok/feat-api-auth';
import type { ErrorReportOptions } from '@wolsok/shared-error-reports';

export interface Environment {
  version: string;
  production: boolean;
  serviceWorkerCheckInterval: number;
  firebaseConfig: FirebaseOptions;
  /**
   * Error reports to Sentry, only from the production build: without it the
   * shell starts no Sentry.
   */
  sentry?: ErrorReportOptions;
}
