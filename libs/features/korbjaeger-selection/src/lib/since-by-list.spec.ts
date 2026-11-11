import { unmarkChange, markChange } from './selection-changes';
import { selectionWrite } from './selection-document';
import { CLUB_COLORS } from './lists/club-colors';
import {
  EMPTY_SELECTION,
  sinceOf,
  withEntryAt,
  type SelectionContent,
} from './selection-lists';

const MIA = { personId: 4711 };
const BEN = { personId: 4712 };
const LEA = { personId: 4713 };

const marked: SelectionContent = {
  ...EMPTY_SELECTION,
  children: [MIA, LEA],
  since: {
    children: new Map([
      [MIA.personId, 10],
      [LEA.personId, 30],
    ]),
  },
};

describe('withEntryAt', () => {
  it('puts a Kind back at its old place, before the first later Kind', () => {
    const after = withEntryAt('children', marked, BEN, 20);

    expect(after.children).toEqual([MIA, BEN, LEA]);
    expect(sinceOf('children', after, BEN.personId)).toBe(20);
  });

  it('adds at the end without a place, keeping no old since', () => {
    const stale: SelectionContent = {
      ...marked,
      since: { children: new Map([[BEN.personId, 5]]) },
    };

    const after = withEntryAt('children', stale, BEN);

    expect(after.children).toEqual([MIA, LEA, BEN]);
    expect(after.since?.children?.has(BEN.personId)).toBe(false);
  });
});

describe('sinceOf', () => {
  it('is none for an entry not held, even with a since kept for it', () => {
    const kept: SelectionContent = {
      ...EMPTY_SELECTION,
      since: { children: new Map([[BEN.personId, 5]]) },
    };

    expect(sinceOf('children', kept, BEN.personId)).toBeUndefined();
  });
});

describe('selectionWrite', () => {
  it("writes a Kind's known since, the next ones for the others", () => {
    const after = withEntryAt('children', marked, BEN, 20);
    const withNew: SelectionContent = {
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
      children: new Map([[BEN.personId, 20]]),
    });
  });

  it('reports the last since it gave out', () => {
    const two: SelectionContent = {
      ...EMPTY_SELECTION,
      teams: [313036, 201500],
    };

    expect(selectionWrite(EMPTY_SELECTION, two, 100).lastSince).toBe(101);
    expect(
      selectionWrite(EMPTY_SELECTION, EMPTY_SELECTION, 100).lastSince
    ).toBe(99);
  });

  it('gives club colours no since', () => {
    const coloured: SelectionContent = {
      ...EMPTY_SELECTION,
      clubColors: [{ clubId: 100, primary: '#ff0000' }],
    };

    const write = selectionWrite(EMPTY_SELECTION, coloured, 100);

    expect(write.fields).toEqual({ clubColors: { 100: '#ff0000' } });
    expect(write.since).toEqual({});
    expect(write.lastSince).toBe(99);
  });
});

describe('CLUB_COLORS.read', () => {
  it('reads the colours without a since', () => {
    expect(CLUB_COLORS.read({ 100: '#ff0000' })).toEqual([
      { value: { clubId: 100, primary: '#ff0000' } },
    ]);
  });
});

describe('a Kind marked again after its unmark', () => {
  it('gets a new since, not the one it had', () => {
    const unmarked = unmarkChange(MIA.personId)(marked);
    const again = markChange({ kind: 'named', personId: 4711 })(unmarked);

    expect(again.children).toEqual([LEA, MIA]);
    // written against the state without it, whose since map still knows it
    expect(selectionWrite(unmarked, again, 100).fields).toEqual({
      children: { 4711: { since: 100 } },
    });
  });
});
