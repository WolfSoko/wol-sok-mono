import type { TranslationKey } from '../../i18n/game-texts';

/** The parts of the main menu's bacterium (#3194), one menu item each. */
export type BacteriumItemId =
  | 'play'
  | 'online'
  | 'training'
  | 'colony'
  | 'evolution'
  | 'profile'
  | 'friends'
  | 'leaderboards'
  | 'my-matches'
  | 'gallery';

/**
 * Where an item sits on the cell, in the cell's box: `x` and `y` from -1
 * (left, bottom) to 1 (right, top), `r` the lobe's radius in the box's
 * half height. The shader draws its lobe there and the menu lays its
 * button over it, so both read these numbers.
 */
export interface BacteriumAnchor {
  x: number;
  y: number;
  r: number;
}

/** The cell's box is this much wider than high. */
export const BACTERIUM_ASPECT = 4 / 3;

/** The ellipse the lobes sit on, in the box's half width and half height. */
const RIM = { x: 0.68, y: 0.66 } as const;

/** A lobe on the rim at `degrees` (0 right, counter-clockwise). */
function rim(degrees: number, r: number): BacteriumAnchor {
  const angle = (degrees * Math.PI) / 180;
  return {
    x: round(RIM.x * Math.cos(angle)),
    y: round(RIM.y * Math.sin(angle)),
    r,
  };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Each item's place: a new game in the nucleus, online on the biggest lobe
 * (top right), the rest around the membrane, 40 degrees apart.
 */
export const BACTERIUM_ANCHORS: Readonly<
  Record<BacteriumItemId, BacteriumAnchor>
> = {
  play: { x: 0, y: 0, r: 0.3 },
  online: rim(35, 0.22),
  friends: rim(75, 0.15),
  leaderboards: rim(115, 0.15),
  training: rim(155, 0.17),
  colony: rim(195, 0.16),
  evolution: rim(235, 0.16),
  profile: rim(275, 0.15),
  'my-matches': rim(315, 0.15),
  gallery: rim(355, 0.15),
};

/** A menu item on the cell: its text, icon, badge and where it leads. */
export interface BacteriumItem {
  id: BacteriumItemId;
  label: TranslationKey;
  icon: string;
  /** The badge's count, 0 for none. */
  count: number;
  /** The text a screen reader hears for the badge, null without one. */
  countKey: TranslationKey | null;
  /** A page to open rather than an item to pick, null for most. */
  link: { url: string; external: boolean } | null;
}

/** What the main menu knows that decides the items, as its tiles do. */
export interface BacteriumMenuState {
  /** True while training missions are left. */
  training: boolean;
  /** True where online matches can be played. */
  online: boolean;
  /** True with the game's cloud: friends. */
  friends: boolean;
  /** True while the leaderboards show. */
  leaderboards: boolean;
  colonyDna: number;
  evolveDna: number;
  friendRequests: number;
  /** The matches of the day's page and whether it opens a tab of its own. */
  gallery: { url: string; external: boolean };
}

/**
 * The items the cell offers in reading order: the nucleus, then round the
 * rim.
 */
export function bacteriumItems(state: BacteriumMenuState): BacteriumItem[] {
  return [
    item('play', 'newGame.title', 'play_arrow'),
    state.online ? item('online', 'newGame.modes.online.name', 'public') : null,
    state.training ? item('training', 'training.menu.title', 'school') : null,
    item('colony', 'colony.title', 'bubble_chart', {
      count: state.colonyDna,
      countKey: 'colony.menu.ready',
    }),
    item('evolution', 'evolution.menu.tile', 'biotech', {
      count: state.evolveDna,
      countKey: 'evolution.menu.ready',
    }),
    item('profile', 'profile.title', 'person'),
    state.friends
      ? item('friends', 'social.friends.title', 'group', {
          count: state.friendRequests,
          countKey: 'menu.friendRequests',
        })
      : null,
    state.leaderboards
      ? item('leaderboards', 'boards.title', 'leaderboard')
      : null,
    item('my-matches', 'replay.matches.title', 'smart_display'),
    {
      ...item('gallery', 'menu.gallery', 'video_library'),
      link: state.gallery,
    },
  ].filter((entry): entry is BacteriumItem => entry !== null);
}

function item(
  id: BacteriumItemId,
  label: TranslationKey,
  icon: string,
  badge: { count: number; countKey: TranslationKey } | null = null
): BacteriumItem {
  const count = Math.max(0, badge?.count ?? 0);
  return {
    id,
    label,
    icon,
    count,
    countKey: count > 0 ? (badge?.countKey ?? null) : null,
    link: null,
  };
}
