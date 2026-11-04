import {
  Dictionary,
  EntryPath,
  format,
  Plural,
  translate,
  Translation,
} from './translation';

const en = {
  lobby: {
    waiting: 'Waiting for {name} to accept…',
    wins: { one: '{count} win', other: '{count} wins' },
  },
  menu: 'Menu',
} satisfies Dictionary;

const de: Translation<typeof en> = {
  lobby: {
    waiting: 'Warte, bis {name} annimmt …',
    wins: { one: '{count} Sieg', other: '{count} Siege' },
  },
  menu: 'Menü',
};

describe('format', () => {
  it('fills the named placeholders', () => {
    expect(format(en.lobby.waiting, 'en-GB', { name: 'Ada' })).toBe(
      'Waiting for Ada to accept…'
    );
  });

  it('leaves a placeholder without a value as it is', () => {
    expect(format(en.lobby.waiting, 'en-GB')).toBe(
      'Waiting for {name} to accept…'
    );
  });

  it('picks the plural form for the count in the language', () => {
    const wins: Plural = de.lobby.wins;

    expect(format(wins, 'de-DE', { count: 1 })).toBe('1 Sieg');
    expect(format(wins, 'de-DE', { count: 0 })).toBe('0 Siege');
    expect(format(en.lobby.wins, 'en-GB', { count: 2 })).toBe('2 wins');
  });

  it('formats numbers for the locale', () => {
    expect(format(en.lobby.wins, 'en-GB', { count: 1500 })).toBe('1,500 wins');
    expect(format(de.lobby.wins, 'de-DE', { count: 1500 })).toBe('1.500 Siege');
  });
});

describe('translate', () => {
  it('takes the text of the language', () => {
    expect(translate(de, en, 'lobby.waiting', 'de-DE', { name: 'Ada' })).toBe(
      'Warte, bis Ada annimmt …'
    );
  });

  it('falls back to English for a text the language lacks', () => {
    const partial = { lobby: {} } as unknown as Dictionary;

    expect(translate(partial, en, 'menu', 'de-DE')).toBe('Menu');
    expect(translate(partial, en, 'lobby.wins', 'de-DE', { count: 3 })).toBe(
      '3 wins'
    );
  });

  it('shows the key where no language has the text', () => {
    expect(translate(de, en, 'lobby.gone', 'de-DE')).toBe('lobby.gone');
    expect(translate(de, en, 'lobby', 'de-DE')).toBe('lobby');
    expect(translate(de, en, 'menu.title', 'de-DE')).toBe('menu.title');
  });

  it('types the keys, plurals included', () => {
    const keys: EntryPath<typeof en>[] = [
      'lobby.waiting',
      'lobby.wins',
      'menu',
    ];
    // @ts-expect-error - no such text
    const wrong: EntryPath<typeof en> = 'lobby.gone';

    expect(keys).toHaveLength(3);
    expect(wrong).toBe('lobby.gone');
  });
});
