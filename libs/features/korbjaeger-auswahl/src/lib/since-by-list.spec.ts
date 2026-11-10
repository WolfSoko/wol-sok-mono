import {
  entmarkierenAenderung,
  markierenAenderung,
} from './auswahl-aenderungen';
import { selectionWrite } from './auswahl-dokument';
import { CLUB_COLORS } from './lists/club-colors';
import {
  LEERE_AUSWAHL,
  sinceOf,
  withEntryAt,
  type AuswahlInhalt,
} from './selection-lists';

const MIA = { personId: 4711 };
const BEN = { personId: 4712 };
const LEA = { personId: 4713 };

const marked: AuswahlInhalt = {
  ...LEERE_AUSWAHL,
  kinder: [MIA, LEA],
  since: {
    kinder: new Map([
      [MIA.personId, 10],
      [LEA.personId, 30],
    ]),
  },
};

describe('withEntryAt', () => {
  it('puts a Kind back at its old place, before the first later Kind', () => {
    const after = withEntryAt('kinder', marked, BEN, 20);

    expect(after.kinder).toEqual([MIA, BEN, LEA]);
    expect(sinceOf('kinder', after, BEN.personId)).toBe(20);
  });

  it('adds at the end without a place, keeping no old since', () => {
    const stale: AuswahlInhalt = {
      ...marked,
      since: { kinder: new Map([[BEN.personId, 5]]) },
    };

    const after = withEntryAt('kinder', stale, BEN);

    expect(after.kinder).toEqual([MIA, LEA, BEN]);
    expect(after.since?.kinder?.has(BEN.personId)).toBe(false);
  });
});

describe('sinceOf', () => {
  it('is none for an entry not held, even with a since kept for it', () => {
    const kept: AuswahlInhalt = {
      ...LEERE_AUSWAHL,
      since: { kinder: new Map([[BEN.personId, 5]]) },
    };

    expect(sinceOf('kinder', kept, BEN.personId)).toBeUndefined();
  });
});

describe('selectionWrite', () => {
  it("writes a Kind's known since, the next ones for the others", () => {
    const after = withEntryAt('kinder', marked, BEN, 20);
    const withNew: AuswahlInhalt = {
      ...after,
      teams: [313036],
    };

    const write = selectionWrite(marked, withNew, 100);

    expect(write.fields).toEqual({
      teams: { 313036: 100 },
      children: { 4712: { since: 20 } },
    });
    expect(write.since).toEqual({
      teams: new Map([[313036, 100]]),
      kinder: new Map([[BEN.personId, 20]]),
    });
  });

  it('reports the last since it gave out', () => {
    const two: AuswahlInhalt = { ...LEERE_AUSWAHL, teams: [313036, 201500] };

    expect(selectionWrite(LEERE_AUSWAHL, two, 100).lastSince).toBe(101);
    expect(selectionWrite(LEERE_AUSWAHL, LEERE_AUSWAHL, 100).lastSince).toBe(
      99
    );
  });

  it('gives club colours no since', () => {
    const coloured: AuswahlInhalt = {
      ...LEERE_AUSWAHL,
      vereinsfarben: [{ vereinId: 100, primaer: '#ff0000' }],
    };

    const write = selectionWrite(LEERE_AUSWAHL, coloured, 100);

    expect(write.fields).toEqual({ clubColors: { 100: '#ff0000' } });
    expect(write.since).toEqual({});
    expect(write.lastSince).toBe(99);
  });
});

describe('CLUB_COLORS.read', () => {
  it('reads the colours without a since', () => {
    expect(CLUB_COLORS.read({ 100: '#ff0000' })).toEqual([
      { value: { vereinId: 100, primaer: '#ff0000' } },
    ]);
  });
});

describe('a Kind marked again after its unmark', () => {
  it('gets a new since, not the one it had', () => {
    const unmarked = entmarkierenAenderung(MIA.personId)(marked);
    const again = markierenAenderung({ art: 'benannt', personId: 4711 })(
      unmarked
    );

    expect(again.kinder).toEqual([LEA, MIA]);
    // written against the state without it, whose since map still knows it
    expect(selectionWrite(unmarked, again, 100).fields).toEqual({
      children: { 4711: { since: 100 } },
    });
  });
});
