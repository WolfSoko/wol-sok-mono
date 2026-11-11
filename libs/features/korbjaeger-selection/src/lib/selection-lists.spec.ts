import {
  readSelectionDocument,
  selectionDocumentWith,
  selectionFields,
  nextSince,
} from './selection-document';
import {
  SELECTION_LIMITS,
  SELECTION_LISTS,
  LIST_DESCRIPTORS,
  selectionIsEmpty,
  selectionWithout,
  selectionJoined,
  EMPTY_SELECTION,
  type SelectionContent,
} from './selection-lists';

const BEFORE: SelectionContent = {
  teams: [313036, 201500],
  children: [{ personId: 4711 }, { personId: 4712, nickname: 'Mia' }],
  clubColors: [{ clubId: 100, primary: '#ff0000' }],
};

const AFTER: SelectionContent = {
  teams: [201500, 201765],
  children: [
    { personId: 4712, nickname: 'Mimi' },
    { personId: 4713, nickname: 'Ben' },
  ],
  clubColors: [
    { clubId: 100, primary: '#00ff00', secondary: '#0000ff' },
    { clubId: 200, primary: '#ffffff' },
  ],
};

describe('LIST_DESCRIPTORS', () => {
  it('describes every list once, with a cap', () => {
    expect(Object.keys(LIST_DESCRIPTORS).sort()).toEqual(
      [...SELECTION_LISTS].sort()
    );
    expect(Object.keys(SELECTION_LIMITS).sort()).toEqual(
      [...SELECTION_LISTS].sort()
    );
  });

  it('stores each list in a field of its own', () => {
    const fields = SELECTION_LISTS.map((list) => LIST_DESCRIPTORS[list].field);

    expect(new Set(fields).size).toBe(SELECTION_LISTS.length);
  });

  it.each([EMPTY_SELECTION, BEFORE])(
    'reads back what a change writes, list by list (from %#)',
    (before) => {
      const stored = selectionDocumentWith(
        { kind: 'none' },
        selectionFields(EMPTY_SELECTION, before, 1)
      );
      const read = readSelectionDocument(stored);
      const fields = selectionFields(before, AFTER, nextSince(read));

      const after = readSelectionDocument(selectionDocumentWith(read, fields));

      for (const list of SELECTION_LISTS) {
        expect(after.kind === 'current' && after[list]).toEqual(AFTER[list]);
      }
    }
  );
});

describe('selectionWithout and selectionJoined', () => {
  it('take entries out by id, and join them each once', () => {
    const without = selectionWithout(AFTER, BEFORE);

    expect(without).toEqual({
      teams: [201765],
      children: [{ personId: 4713, nickname: 'Ben' }],
      clubColors: [{ clubId: 200, primary: '#ffffff' }],
    });
    expect(selectionJoined(BEFORE, AFTER)).toEqual({
      teams: [...BEFORE.teams, ...without.teams],
      children: [...BEFORE.children, ...without.children],
      clubColors: [...BEFORE.clubColors, ...without.clubColors],
    });
  });

  it('tells an Auswahl that holds nothing', () => {
    expect(selectionIsEmpty(EMPTY_SELECTION)).toBe(true);
    expect(
      selectionIsEmpty({ ...EMPTY_SELECTION, children: [{ personId: 4711 }] })
    ).toBe(false);
  });
});
