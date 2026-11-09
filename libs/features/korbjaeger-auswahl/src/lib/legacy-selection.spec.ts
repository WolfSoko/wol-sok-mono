import { auswahlDokumentLesen } from './auswahl-dokument';
import { legacySelection } from './legacy-selection';

/** What the reader of this version makes of a legacy document. */
function read(raw: unknown) {
  return auswahlDokumentLesen(legacySelection(raw));
}

describe('legacySelection', () => {
  it('renames the fields of version 2, keeping every value', () => {
    expect(
      legacySelection({
        version: 2,
        teams: { 313036: 10, 201500: 20 },
        kinder: { 4711: { seit: 30, spitzname: 'Mimi' }, 4712: { seit: 40 } },
        vereinsfarben: { 4343: '#1d4ed8,#ffffff' },
      })
    ).toEqual({
      version: 3,
      teams: { 313036: 10, 201500: 20 },
      children: { 4711: { since: 30, nickname: 'Mimi' }, 4712: { since: 40 } },
      clubColors: { 4343: '#1d4ed8,#ffffff' },
    });
  });

  it("makes version 1's lists maps in their order, each person once", () => {
    expect(
      legacySelection({
        version: 1,
        teams: [313036, 201500, 313036],
        kinder: [
          { personId: 4712 },
          { personId: 4711, spitzname: 'Mi' },
          { personId: 4712, spitzname: 'twice' },
          { personId: 'no id' },
        ],
      })
    ).toEqual({
      version: 3,
      teams: { 313036: 1, 201500: 2 },
      children: { 4712: { since: 1 }, 4711: { since: 2, nickname: 'Mi' } },
    });
  });

  it('reads as the same choices, in the same order', () => {
    const gelesen = read({
      version: 1,
      teams: [313036, 201500],
      kinder: [{ personId: 4712 }, { personId: 4711, spitzname: 'Mimi' }],
    });

    expect(gelesen.art === 'aktuell' && gelesen.teams).toEqual([
      313036, 201500,
    ]);
    expect(gelesen.art === 'aktuell' && gelesen.kinder).toEqual([
      { personId: 4712 },
      { personId: 4711, spitzname: 'Mimi' },
    ]);
  });

  it.each([
    ['no map', [313036]],
    ['no version', { teams: [313036] }],
    ['version 3', { version: 3, teams: {} }],
    ['a newer version', { version: 4, teams: {} }],
  ])('takes %s for none', (_, raw) => {
    expect(legacySelection(raw)).toBeUndefined();
  });

  it.each([
    ['no list of Teams', { version: 1, teams: 313036 }],
    ['a Team that is no DBB id', { version: 1, teams: [313036, '201500'] }],
    ['a negative Team id', { version: 1, teams: [-1] }],
  ])('reads a document with %s as none, as before', (_, raw) => {
    expect(read(raw)).toEqual({ art: 'keins' });
  });

  it('keeps the Teams where the Kinder are malformed', () => {
    const gelesen = read({ version: 2, teams: { 313036: 1 }, kinder: 'x' });

    expect(gelesen.art === 'aktuell' && gelesen.teams).toEqual([313036]);
    expect(gelesen.art === 'aktuell' && gelesen.kinder).toEqual([]);
  });
});
