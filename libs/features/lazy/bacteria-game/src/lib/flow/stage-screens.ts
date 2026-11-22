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

/** The texts naming the screens a way back leads to, the menu's unless listed. */
const BACK_LABEL_KEYS: Readonly<Partial<Record<MenuScreen, TranslationKey>>> = {
  profile: 'profile.title',
};

/**
 * Names where the way back from a screen leads (`parentScreen`), for its
 * back button - the pause menu instead of the menu while the match is
 * paused, as the stage shows the pause menu for the menu then.
 */
export function backLabelKey(
  screen: MenuScreen,
  paused: boolean
): TranslationKey {
  const parent = parentScreen(screen);
  if (paused && parent === 'menu') {
    return 'stage.pause.back';
  }
  return BACK_LABEL_KEYS[parent] ?? 'common.menu';
}

/** True for `screen` itself and the screens opened from it. */
export function opensFrom(panel: StagePanel, screen: MenuScreen): boolean {
  return (
    panel === screen ||
    (panel !== null &&
      (PARENT_OF as Record<string, MenuScreen>)[panel] === screen)
  );
}
