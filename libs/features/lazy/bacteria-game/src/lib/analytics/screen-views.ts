import { effect, Signal, untracked } from '@angular/core';
import { injectGameAnalytics } from './game-analytics';

/**
 * A screen view for each screen the stage shows: a menu screen, the pause
 * menu, the result, or `match` while one is on. The game keeps one URL, so
 * these are what tells its screens apart. Null shows nothing to count (the
 * arena being cleared). Call in an injection context.
 */
export function trackScreenViews(screen: Signal<string | null>): void {
  const analytics = injectGameAnalytics();
  effect(() => {
    const shown = screen();
    if (shown !== null) {
      untracked(() => analytics.screenView(shown));
    }
  });
}
