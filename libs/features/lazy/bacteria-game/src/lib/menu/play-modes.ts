import type { GameMode } from '../state/game.states';

/** The ways to play a new game offers, each with steps of its own. */
export type PlayKind =
  | 'campaign'
  | 'daily'
  | 'endless'
  | 'free'
  | 'two-players'
  | 'online';

/** The steps of a new game: the mode, then the level, then the start. */
export type NewGameStep = 'mode' | 'level' | 'start';

/** Where a new game opens: on a mode already picked, at one of its steps. */
export interface NewGameEntry {
  kind: PlayKind | null;
  step: NewGameStep;
}

export interface PlayMode {
  kind: PlayKind;
  name: string;
  icon: string;
  blurb: string;
}

export const PLAY_MODES: readonly PlayMode[] = [
  {
    kind: 'campaign',
    name: 'Campaign',
    icon: 'flag',
    blurb: 'The ladder level by level - win one to open the next.',
  },
  {
    kind: 'daily',
    name: 'Daily level',
    icon: 'today',
    blurb: 'One generated level a day, the same for everyone.',
  },
  {
    kind: 'endless',
    name: 'Endless run',
    icon: 'all_inclusive',
    blurb: 'Generated levels one after the other - how deep can you get?',
  },
  {
    kind: 'free',
    name: 'Free play',
    icon: 'explore',
    blurb: 'Every level open, and new ones from the generator.',
  },
  {
    kind: 'two-players',
    name: 'Two players',
    icon: 'group',
    blurb: 'One screen, two colonies - a series between friends.',
  },
  {
    kind: 'online',
    name: 'Online',
    icon: 'public',
    blurb: 'Two devices, one match - share a code with a friend.',
  },
];

export const STEP_LABELS: Readonly<Record<NewGameStep, string>> = {
  mode: 'Mode',
  level: 'Level',
  start: 'Start',
};

/**
 * The steps a mode goes through. The daily level and the endless run pick
 * their levels themselves, so they skip the level choice. Before a mode is
 * picked, the steps most modes have are shown ahead.
 */
export function stepsOf(kind: PlayKind | null): readonly NewGameStep[] {
  return kind === 'daily' || kind === 'endless'
    ? ['mode', 'start']
    : ['mode', 'level', 'start'];
}

/**
 * Who plays in a mode: the computer, or a second human - null online, where
 * the connection decides and the setup stays as it is.
 */
export function opponentOf(kind: PlayKind): GameMode | null {
  switch (kind) {
    case 'online':
      return null;
    case 'two-players':
      return 'two-players';
    default:
      return 'vs-computer';
  }
}
