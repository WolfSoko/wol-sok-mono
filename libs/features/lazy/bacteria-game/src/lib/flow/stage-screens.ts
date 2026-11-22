/** The screens of the menu that is shown while no match is on. */
export type MenuScreen =
  | 'menu'
  | 'new-game'
  | 'colony'
  | 'profile'
  // Every achievement, opened from the profile.
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
