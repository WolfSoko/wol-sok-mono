import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, untracked } from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { ProgressService } from '../progress.service';
import { GameSettingsService } from '../settings.service';
import { rankFor } from '../state/ranks';
import { GameAccount, type PlayerProfile } from '../storage/game-account';
import { GAME_SUPPORT, GameSupportOptions } from '../support/game-support';
import { isInstalledWebApp } from '../support/install-offer.service';
import { isTwaSession } from '../support/twa-session';
import { injectGameAnalytics } from './game-analytics';

/** Where the game runs: the Play Store app, an installed web app, a tab. */
export type GamePlatform = 'android_app' | 'web_app' | 'browser';

/** Who plays: a guest or a Google account in the cloud, or this device only. */
export type AccountKind = 'guest' | 'google' | 'device';

/**
 * Keeps the user properties up to date - the language, where the game runs,
 * who plays, their rank and free play - so every event can be told apart by them. Call
 * in the stage's injection context: by then the game cloud is set up.
 */
export function reportUserProperties(): void {
  const analytics = injectGameAnalytics();
  const i18n = inject(I18nService);
  const account = inject(GameAccount);
  const progress = inject(ProgressService);
  const settings = inject(GameSettingsService);
  const platform = gamePlatform(inject(DOCUMENT), inject(GAME_SUPPORT));
  // computed, so a match's XP or a profile read again sends nothing new
  const rank = computed(() => rankFor(progress.xp()).number);
  const kind = computed(() => accountKind(account.cloud, account.profile()));
  effect(() => {
    const properties = {
      language: i18n.language(),
      platform,
      account: kind(),
      rank: rank(),
      // the ladder's locks off: matches against the computer are free play
      free_play: settings.freePlay(),
    };
    untracked(() => analytics.setUserProperties(properties));
  });
}

export function gamePlatform(
  document: Document,
  support: GameSupportOptions | null
): GamePlatform {
  if (support && isTwaSession(document, support.androidPackage)) {
    return 'android_app';
  }
  const window = document.defaultView;
  return window && isInstalledWebApp(window) ? 'web_app' : 'browser';
}

/** Null while the cloud has not told who plays yet. */
export function accountKind(
  cloud: boolean,
  profile: Pick<PlayerProfile, 'guest'> | null
): AccountKind | null {
  if (!cloud) return 'device';
  if (profile === null) return null;
  return profile.guest ? 'guest' : 'google';
}
