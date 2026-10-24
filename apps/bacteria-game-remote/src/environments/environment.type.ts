import type {
  GameCloudOptions,
  GameSupportOptions,
} from '@wolsok/feat-lazy-bac-game';

export interface Environment {
  production: boolean;
  /**
   * The Firebase project that keeps the players' progress, null to keep it
   * in the browser's local storage.
   */
  gameCloud: GameCloudOptions | null;
  /** Tips and ads on the game's own site. */
  support: GameSupportOptions;
}
