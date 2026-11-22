import type { TranslationKey } from '../i18n/game-texts';

/** The screens of the menu that is shown while no match is on. */
export type MenuScreen =
  | 'menu'
  | 'new-game'
  | 'colony'
  | 'profile'
  | 'achievements'
  | 'friends'
  | 'settings'
  | 'help'
  | 'evolution'
  | 'leaderboards'
  | 'my-matches'
  // The match just played, watched again from its result.
  | 'replay';

/** What is laid over the arena right now, nothing while a match is on. */
export type StagePanel = MenuScreen | 'pause' | 'over' | null;

/** The screens opened from another screen than the menu, and that screen. */
const PARENT_OF: Readonly<Partial<Record<MenuScreen, MenuScreen>>> = {
  achievements: 'profile',
};

/** Where the way back from a screen leads: the menu, unless it was opened elsewhere. */
export function parentScreen(screen: MenuScreen): MenuScreen {
  return PARENT_OF[screen] ?? 'menu';
}

/** Where the way back from a screen leads: a menu screen, or the pause menu. */
export type BackTarget = MenuScreen | 'pause';

/**
 * Where the way back from the open screen leads: the pause menu while the
 * match is paused, which only the settings open on top of, else the screen
 * it was opened from.
 */
export function backTarget(screen: MenuScreen, paused: boolean): BackTarget {
  return paused ? 'pause' : parentScreen(screen);
}

/** The texts naming where the way back leads, the menu's unless listed. */
const BACK_LABEL_KEYS: Readonly<Partial<Record<BackTarget, TranslationKey>>> = {
  pause: 'stage.pause.back',
  profile: 'profile.title',
};

/** The text naming a way back's target, for the screen's back button. */
export function backLabelKey(target: BackTarget): TranslationKey {
  return BACK_LABEL_KEYS[target] ?? 'common.menu';
}

/** True for `screen` itself and the screens opened from it. */
export function opensFrom(panel: StagePanel, screen: MenuScreen): boolean {
  return (
    panel === screen ||
    (panel !== null &&
      (PARENT_OF as Record<string, MenuScreen>)[panel] === screen)
  );
}
