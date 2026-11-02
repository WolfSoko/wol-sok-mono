import type {
  GameCloudOptions,
  GameSupportOptions,
} from '@wolsok/feat-lazy-bac-game';
import type { ErrorReportOptions } from '../app/error-reports/error-reports';

export interface Environment {
  production: boolean;
  /**
   * The Firebase project that keeps the players' progress, null to keep it
   * in the browser's local storage.
   */
  gameCloud: GameCloudOptions | null;
  /** Tips and ads on the game's own site. */
  support: GameSupportOptions;
  /**
   * Error reports to Sentry, only from the live site: without it the game
   * starts no Sentry.
   */
  sentry?: ErrorReportOptions;
}
