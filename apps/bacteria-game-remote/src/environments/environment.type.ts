import type { GameCloudOptions } from '@wolsok/feat-lazy-bac-game';

export interface Environment {
  production: boolean;
  /**
   * The Firebase project that keeps the players' progress, null to keep it
   * in the browser's local storage.
   */
  gameCloud: GameCloudOptions | null;
}
