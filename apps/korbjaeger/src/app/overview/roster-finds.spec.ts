import type { ResourceStatus } from '@angular/core';
import type { RosterFinds } from '@wolsok/feat-shared-basketball-data';
import {
  findsAfter,
  UNREADABLE,
  searchEnd,
  searching,
  type RosterSearchState,
} from './roster-finds';

const FUNDE: RosterFinds = {
  games: new Map([[3, new Map([[4711, 'Lumi']])]]),
  incomplete: false,
};

function search(
  status: ResourceStatus,
  value?: RosterFinds
): RosterSearchState {
  return status === 'error'
    ? { status, error: new Error('offline') }
    : { status, value };
}

describe('searchEnd', () => {
  it('ends with the finds a search gave', () => {
    expect(searchEnd(search('resolved', FUNDE))).toEqual({
      kind: 'found',
      finds: FUNDE,
    });
  });

  it('ends as failed where the search failed as a whole', () => {
    expect(searchEnd(search('error'))).toEqual({ kind: 'failed' });
  });

  it.each<ResourceStatus>(['idle', 'loading'])(
    'has not ended while %s',
    (status) => {
      expect(searchEnd(search(status))).toBeUndefined();
    }
  );
});

describe('findsAfter', () => {
  const VORHER: RosterFinds = {
    games: new Map([[2, undefined]]),
    incomplete: false,
  };

  it('takes the finds of a search that ended', () => {
    expect(findsAfter({ kind: 'found', finds: FUNDE }, VORHER)).toBe(FUNDE);
  });

  it('keeps the last finds while a search runs again', () => {
    expect(findsAfter(undefined, VORHER)).toBe(VORHER);
  });

  it('keeps the last finds of a failed run, marked as incomplete', () => {
    expect(findsAfter({ kind: 'failed' }, VORHER)).toEqual({
      games: VORHER.games,
      incomplete: true,
    });
  });

  it('reads a failed first run as one that read nothing', () => {
    expect(findsAfter({ kind: 'failed' }, undefined)).toBe(UNREADABLE);
  });

  it('has no finds before the first search ended', () => {
    expect(findsAfter(undefined, undefined)).toBeUndefined();
  });
});

describe('sucht', () => {
  it('searches while the read runs, kept finds or not', () => {
    expect(searching(search('loading'))).toBe(true);
    expect(searching(search('reloading', FUNDE))).toBe(true);
  });

  it('searches while no search has ended yet', () => {
    expect(searching(search('idle'))).toBe(true);
  });

  it('searches no more once a search ended, with finds or failed', () => {
    expect(searching(search('resolved', FUNDE))).toBe(false);
    expect(searching(search('error'))).toBe(false);
  });
});
