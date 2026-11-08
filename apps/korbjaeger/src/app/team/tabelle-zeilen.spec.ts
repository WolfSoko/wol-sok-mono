import type {
  Tabelle,
  TabellenZeile,
} from '@wolsok/feat-shared-basketball-data';
import { tabelleZeilen } from './tabelle-zeilen';

function zeile(
  rang: number,
  id: number,
  name: string,
  koerbe: number,
  gegenkoerbe: number
): TabellenZeile {
  return {
    rang,
    partei: { art: 'team', team: { id, name, vereinId: id } },
    spiele: 5,
    siege: 5 - rang,
    niederlagen: rang,
    punkte: 2 * (5 - rang),
    koerbe,
    gegenkoerbe,
    korbdifferenz: koerbe - gegenkoerbe,
  };
}

const TABELLE: Tabelle = {
  liga: {
    id: 54862,
    name: 'Regionsvorrunde Nord Braunschweig mu12',
    verband: { id: 7, name: 'Niedersachsen' },
    altersklasse: 'U12',
    geschlecht: 'mix',
    spielklasse: 'Regionsliga',
  },
  zeilen: [
    zeile(1, 313040, 'TV Jahn Wolfsburg', 510, 191),
    zeile(2, 313036, 'MTV Wasbüttel', 470, 470),
    zeile(3, 322695, 'SV Groß Schwülper', 102, 575),
  ],
};

describe('tabelleZeilen', () => {
  it('shows each line with its points for and against and the difference', () => {
    expect(tabelleZeilen(TABELLE, 313036)[0]).toEqual({
      rang: 1,
      team: 'TV Jahn Wolfsburg',
      spiele: 5,
      siege: 4,
      niederlagen: 1,
      koerbe: '510:191',
      differenz: '+319',
      eigenes: false,
    });
  });

  it('signs a negative difference with a minus and leaves an even one bare', () => {
    expect(
      tabelleZeilen(TABELLE, 313036).map(({ differenz }) => differenz)
    ).toEqual(['+319', '0', '−473']);
  });

  it("marks the Team's own line, and only that one", () => {
    expect(
      tabelleZeilen(TABELLE, 313036).map(({ eigenes }) => eigenes)
    ).toEqual([false, true, false]);
  });

  it('names a slot of a Hauptrunde, which is never the Team', () => {
    const slot: TabellenZeile = {
      ...zeile(1, 0, '', 0, 0),
      partei: { art: 'offen', bezeichnung: 'Nord 1. Platz' },
    };

    expect(
      tabelleZeilen({ ...TABELLE, zeilen: [slot] }, 313036)[0]
    ).toMatchObject({ team: 'Nord 1. Platz', eigenes: false, differenz: '0' });
  });

  it('marks no line of a Tabelle without the Team', () => {
    expect(tabelleZeilen(TABELLE, 1).some(({ eigenes }) => eigenes)).toBe(
      false
    );
  });
});
