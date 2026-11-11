import {
  readSelectionDocument,
  selectionFields,
  selectionWrite,
} from './selection-document';
import {
  EMPTY_SELECTION,
  withSince,
  type SelectionContent,
} from './selection-lists';

describe('readSelectionDocument', () => {
  it("reads each Team's since", () => {
    const read = readSelectionDocument({
      version: 3,
      teams: { 201500: 20, 313036: 10 },
      children: {},
    });

    expect(read.kind === 'current' && read.since?.teams).toEqual(
      new Map([
        [313036, 10],
        [201500, 20],
      ])
    );
  });

  it('reads a document with more entries than a call takes arguments', () => {
    const teams = Object.fromEntries(
      Array.from({ length: 200_000 }, (_, i) => [100_000 + i, i + 1])
    );

    const read = readSelectionDocument({ version: 3, teams, children: {} });

    expect(read.kind === 'current' && read.latestSince).toBe(200_000);
  });

  it('reads a document of an earlier version as none', () => {
    expect(
      readSelectionDocument({ version: 2, teams: { 313036: 1 }, kinder: {} })
    ).toEqual({ kind: 'none' });
  });
});

describe('selectionFields', () => {
  it("writes a new Team's known since, the next one for the others", () => {
    const before: SelectionContent = { ...EMPTY_SELECTION, teams: [313036] };
    const after: SelectionContent = {
      ...EMPTY_SELECTION,
      teams: [201765, 313036, 201500],
      since: {
        teams: new Map([
          [201765, 5],
          [313036, 10],
        ]),
      },
    };

    expect(selectionFields(before, after, 100)).toEqual({
      teams: { 201765: 5, 201500: 100 },
    });
  });
});

describe('selectionFields with an entry twice', () => {
  it('writes nothing for an entry it held already', () => {
    const before: SelectionContent = {
      ...EMPTY_SELECTION,
      teams: [313036],
      children: [{ personId: 4711 }],
    };
    const after: SelectionContent = {
      ...EMPTY_SELECTION,
      teams: [313036, 313036],
      children: [{ personId: 4711 }, { personId: 4711 }],
    };

    expect(selectionFields(before, after, 100)).toEqual({});
  });
});

describe('withSince', () => {
  it('gives the Teams it holds the since a write stores for them', () => {
    const content: SelectionContent = {
      ...EMPTY_SELECTION,
      teams: [313036, 201500],
    };

    const { since: sinceWritten } = selectionWrite(
      { ...EMPTY_SELECTION, teams: [313036] },
      { ...EMPTY_SELECTION, teams: [201500, 201765] },
      42
    );

    expect(sinceWritten.teams).toEqual(
      new Map([
        [201500, 42],
        [201765, 43],
      ])
    );
    expect(withSince(content, sinceWritten).since?.teams).toEqual(
      new Map([[201500, 42]])
    );
  });
});
