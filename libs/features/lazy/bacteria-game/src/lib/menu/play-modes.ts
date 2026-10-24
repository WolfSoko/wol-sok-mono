import type { TranslationKey } from '../i18n/dictionaries';
import type { GameMode } from '../state/game.states';

/** The ways to play a new game offers, each with steps of its own. */
export type PlayKind =
  | 'training'
  | 'campaign'
  | 'daily'
  | 'endless'
  | 'free'
  | 'two-players'
  | 'online';

/**
 * The steps of a new game: the mode, then the level - the training's
 * mission - then the start.
 */
export type NewGameStep = 'mode' | 'level' | 'start';

/** Where a new game opens: on a mode already picked, at one of its steps. */
export interface NewGameEntry {
  kind: PlayKind | null;
  step: NewGameStep;
}

export interface PlayMode {
  kind: PlayKind;
  /** The keys of its name and its line. */
  name: TranslationKey;
  blurb: TranslationKey;
  icon: string;
}

const ICONS: Readonly<Record<PlayKind, string>> = {
  training: 'school',
  campaign: 'flag',
  daily: 'today',
  endless: 'all_inclusive',
  free: 'explore',
  'two-players': 'group',
  online: 'public',
};

export const PLAY_MODES: readonly PlayMode[] = (
  Object.keys(ICONS) as PlayKind[]
).map((kind) => ({
  kind,
  name: `newGame.modes.${kind}.name`,
  blurb: `newGame.modes.${kind}.blurb`,
  icon: ICONS[kind],
}));

/** The keys of the steps' names. */
export const STEP_LABELS: Readonly<Record<NewGameStep, TranslationKey>> = {
  mode: 'newGame.steps.mode',
  level: 'newGame.steps.level',
  start: 'newGame.steps.start',
};

/**
 * The steps a mode goes through. The daily level and the endless run pick
 * their levels themselves, so they skip the level choice. An online match
 * opens on the lobby, where the player finds, joins or opens a match: only
 * the one `creating` a match picks its level. Before a mode is picked, the
 * steps most modes have are shown ahead.
 */
export function stepsOf(
  kind: PlayKind | null,
  creating = false
): readonly NewGameStep[] {
  const picksLevel =
    kind !== 'daily' && kind !== 'endless' && (kind !== 'online' || creating);
  return picksLevel ? ['mode', 'level', 'start'] : ['mode', 'start'];
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
