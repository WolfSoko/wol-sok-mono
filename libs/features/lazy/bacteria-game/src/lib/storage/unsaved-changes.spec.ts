import {
  parseUnsaved,
  storedUnsaved,
  unsavedEntry,
  unsavedKey,
  unsavedOf,
  withoutUnchanged,
  withoutUnsaved,
  withUnsaved,
} from './unsaved-changes';

describe('unsaved changes', () => {
  it('go under a key of their own next to the document', () => {
    expect(unsavedKey('bacteria-game.progress')).toBe(
      'bacteria-game.progress.unsaved'
    );
  });

  it('keep one entry per page and player', () => {
    expect(unsavedEntry('page-1', 'ada')).toBe('page-1:ada');
    expect(unsavedEntry('page-1', 'ada')).not.toBe(
      unsavedEntry('page-2', 'ada')
    );
  });

  it('read back what is an unsaved change and drop the rest', () => {
    expect(
      parseUnsaved({
        good: { player: 'ada', value: ['gold'] },
        noPlayer: { value: ['gold'] },
        noValue: { player: 'ada' },
        broken: 'text',
        none: null,
      })
    ).toEqual({ good: { player: 'ada', value: ['gold'] } });
  });

  it('read nothing from what is not a map of changes', () => {
    expect(parseUnsaved(null)).toEqual({});
    expect(parseUnsaved([{ player: 'ada', value: 1 }])).toEqual({});
    expect(parseUnsaved('text')).toEqual({});
  });

  it('set and remove entries', () => {
    const one = withUnsaved({}, 'p:ada', { player: 'ada', value: 1 });
    const two = withUnsaved(one, 'p:bob', { player: 'bob', value: 2 });
    const replaced = withUnsaved(two, 'p:ada', { player: 'ada', value: 3 });

    expect(replaced).toEqual({
      'p:ada': { player: 'ada', value: 3 },
      'p:bob': { player: 'bob', value: 2 },
    });
    expect(withoutUnsaved(replaced, ['p:ada'])).toEqual({
      'p:bob': { player: 'bob', value: 2 },
    });
    expect(withoutUnsaved(replaced, ['p:none'])).toBe(replaced);
  });

  it("find a player's changes only", () => {
    const changes = {
      'p:ada': { player: 'ada', value: 1 },
      'q:ada': { player: 'ada', value: 2 },
      'p:bob': { player: 'bob', value: 3 },
    };

    expect(unsavedOf(changes, 'ada')).toEqual({
      'p:ada': { player: 'ada', value: 1 },
      'q:ada': { player: 'ada', value: 2 },
    });
    expect(unsavedOf(changes, 'eve')).toEqual({});
  });

  it('remove only the entries that still hold what was read', () => {
    const read = {
      'p:ada': { player: 'ada', value: ['gold'] },
      'q:ada': { player: 'ada', value: ['gold'] },
    };
    const now = {
      'p:ada': { player: 'ada', value: ['gold'] },
      'q:ada': { player: 'ada', value: ['gold', 'silver'] },
      'p:bob': { player: 'bob', value: ['bronze'] },
    };

    expect(withoutUnchanged(now, read)).toEqual({
      'q:ada': { player: 'ada', value: ['gold', 'silver'] },
      'p:bob': { player: 'bob', value: ['bronze'] },
    });
  });

  it('store nothing once no change is left', () => {
    expect(storedUnsaved({})).toBeNull();
    const changes = { 'p:ada': { player: 'ada', value: 1 } };
    expect(storedUnsaved(changes)).toBe(changes);
  });
});
