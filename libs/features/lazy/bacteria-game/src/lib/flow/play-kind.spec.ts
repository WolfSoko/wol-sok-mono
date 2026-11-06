import { PlayKind } from '../menu/play-modes';
import type { MatchEndAction } from '../winner-info/winner.component';
import {
  levelsEntry,
  playKindOf,
  PlayKindState,
  screenAfterMatch,
} from './play-kind';
import type { MenuScreen } from './stage-screens';

describe('the mode last played', () => {
  const nothing: PlayKindState = {
    matchKind: 'vs-computer',
    lastKind: null,
    mode: 'vs-computer',
    freePlay: false,
  };

  it.each<[string, Partial<PlayKindState>, PlayKind]>([
    ['the campaign by default', {}, 'campaign'],
    ['free play where it is set', { freePlay: true }, 'free'],
    ['two players by the mode', { mode: 'two-players' }, 'two-players'],
    ['an endless run while one is on', { matchKind: 'endless' }, 'endless'],
    ['the daily level while it is set', { matchKind: 'daily' }, 'daily'],
    [
      'the mode picked before all that',
      { lastKind: 'online', matchKind: 'daily' },
      'online',
    ],
    [
      'no training picked once',
      { lastKind: 'training', freePlay: true },
      'free',
    ],
    [
      'the training while a mission is set',
      { matchKind: 'training', lastKind: 'online' },
      'training',
    ],
  ])('is %s', (_, state, kind) => {
    expect(playKindOf({ ...nothing, ...state })).toBe(kind);
  });
});

describe('the levels of a mode, from the result screen', () => {
  it.each<[PlayKind, 'level' | 'mode']>([
    ['campaign', 'level'],
    ['free', 'level'],
    ['training', 'level'],
    ['two-players', 'level'],
    ['daily', 'mode'],
    ['endless', 'mode'],
    ['online', 'mode'],
  ])('open %s on its %s step', (kind, step) => {
    expect(levelsEntry(kind)).toEqual({ kind, step });
  });
});

describe('the screen after a match', () => {
  it.each<[MatchEndAction, MenuScreen]>([
    ['levels', 'new-game'],
    ['evolve', 'evolution'],
    ['watch', 'replay'],
    ['menu', 'menu'],
    ['again', 'menu'],
    ['next', 'menu'],
    ['endless', 'menu'],
    ['mission', 'menu'],
    ['campaign', 'menu'],
    ['ghost', 'menu'],
  ])('backs out of %s to %s', (action, screen) => {
    expect(screenAfterMatch(action)).toBe(screen);
  });
});
