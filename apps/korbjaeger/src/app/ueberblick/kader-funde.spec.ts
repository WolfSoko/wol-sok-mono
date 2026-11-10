import type { ResourceStatus } from '@angular/core';
import type { RosterFinds } from '@wolsok/feat-shared-basketball-data';
import {
  fundeNach,
  NICHT_LESBAR,
  suchEnde,
  sucht,
  type KaderSuchStand,
} from './kader-funde';

const FUNDE: RosterFinds = {
  games: new Map([[3, new Map([[4711, 'Lumi']])]]),
  incomplete: false,
};

function suche(status: ResourceStatus, value?: RosterFinds): KaderSuchStand {
  return status === 'error'
    ? { status, error: new Error('offline') }
    : { status, value };
}

describe('suchEnde', () => {
  it('ends with the finds a search gave', () => {
    expect(suchEnde(suche('resolved', FUNDE))).toEqual({
      art: 'gefunden',
      funde: FUNDE,
    });
  });

  it('ends as failed where the search failed as a whole', () => {
    expect(suchEnde(suche('error'))).toEqual({ art: 'gescheitert' });
  });

  it.each<ResourceStatus>(['idle', 'loading'])(
    'has not ended while %s',
    (status) => {
      expect(suchEnde(suche(status))).toBeUndefined();
    }
  );
});

describe('fundeNach', () => {
  const VORHER: RosterFinds = {
    games: new Map([[2, undefined]]),
    incomplete: false,
  };

  it('takes the finds of a search that ended', () => {
    expect(fundeNach({ art: 'gefunden', funde: FUNDE }, VORHER)).toBe(FUNDE);
  });

  it('keeps the last finds while a search runs again', () => {
    expect(fundeNach(undefined, VORHER)).toBe(VORHER);
  });

  it('keeps the last finds of a failed run, marked as incomplete', () => {
    expect(fundeNach({ art: 'gescheitert' }, VORHER)).toEqual({
      games: VORHER.games,
      incomplete: true,
    });
  });

  it('reads a failed first run as one that read nothing', () => {
    expect(fundeNach({ art: 'gescheitert' }, undefined)).toBe(NICHT_LESBAR);
  });

  it('has no finds before the first search ended', () => {
    expect(fundeNach(undefined, undefined)).toBeUndefined();
  });
});

describe('sucht', () => {
  it('searches while the read runs, kept finds or not', () => {
    expect(sucht(suche('loading'))).toBe(true);
    expect(sucht(suche('reloading', FUNDE))).toBe(true);
  });

  it('searches while no search has ended yet', () => {
    expect(sucht(suche('idle'))).toBe(true);
  });

  it('searches no more once a search ended, with finds or failed', () => {
    expect(sucht(suche('resolved', FUNDE))).toBe(false);
    expect(sucht(suche('error'))).toBe(false);
  });
});
