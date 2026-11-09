import type { BasketballData } from '../basketball-data';
import { BasketballDataError } from './basketball-data-error';
import { kaderSuchen } from './kader-suche';
import type { Spiel } from './spiel';
import type { BenannterSpieler, Spielbericht } from './spielbericht';
import type { Team } from './team';

const WASBUETTEL: Team = { id: 313036, name: 'MTV Wasbüttel', vereinId: 1837 };
const GIFHORN: Team = { id: 201500, name: 'MTV Gifhorn', vereinId: 1500 };

function spieler(personId: number, vorname: string): BenannterSpieler {
  return { art: 'benannt', personId, vorname, nachname: 'Ahornwiese' };
}

const LUMI = spieler(4711, 'Lumi');
const MORVO = spieler(4712, 'Morvo');
const NELKA = spieler(4713, 'Nelka');

function spiel(
  id: number,
  heim: Team = WASBUETTEL,
  gast: Team = GIFHORN
): Spiel {
  return {
    id,
    ligaId: 54862,
    spieltag: 1,
    datum: '2026-11-01',
    heim: { art: 'team', team: heim },
    gast: { art: 'team', team: gast },
    status: {
      art: 'gespielt',
      ergebnis: { heim: 50, gast: 40 },
      bestaetigt: true,
    },
  };
}

function bericht(
  spielId: number,
  heim: readonly BenannterSpieler[],
  gast: readonly BenannterSpieler[] = []
): Spielbericht {
  return {
    spielId,
    heim: {
      spielerwerteErfasst: false,
      eintraege: [...heim, { art: 'anonym' }],
    },
    gast: { spielerwerteErfasst: false, eintraege: [...gast] },
  };
}

type BerichtRead = BasketballData['spielbericht'];

/** Answers each Spiel's Spielbericht from `berichte`; one not listed has none. */
function data(berichte: Readonly<Record<number, Spielbericht | Error>>): {
  readonly spielbericht: jest.Mock<
    ReturnType<BerichtRead>,
    Parameters<BerichtRead>
  >;
} {
  return {
    spielbericht: jest.fn<ReturnType<BerichtRead>, Parameters<BerichtRead>>(
      async (spielId) => {
        const antwort = berichte[spielId];
        if (antwort instanceof Error) {
          throw antwort;
        }
        return antwort;
      }
    ),
  };
}

function gelesen(funde: Awaited<ReturnType<typeof kaderSuchen>>) {
  return [...funde.spiele].map(([spielId, kinder]) => [
    spielId,
    kinder && Object.fromEntries(kinder),
  ]);
}

describe('kaderSuchen', () => {
  it('reads only the last Spiel where every Kind is on its Kader', async () => {
    const quelle = data({
      3: bericht(3, [LUMI, MORVO]),
      2: bericht(2, [LUMI]),
    });

    const funde = await kaderSuchen(quelle, {
      team: WASBUETTEL.id,
      spiele: [spiel(3), spiel(2)],
      kinder: [LUMI.personId, MORVO.personId],
    });

    expect(gelesen(funde)).toEqual([
      [3, { [LUMI.personId]: 'Lumi', [MORVO.personId]: 'Morvo' }],
    ]);
    expect(funde.unvollstaendig).toBe(false);
    expect(quelle.spielbericht).toHaveBeenCalledTimes(1);
  });

  it('reads on two at a time, newest first, until each Kind was found', async () => {
    const quelle = data({
      5: bericht(5, [LUMI]),
      3: bericht(3, [MORVO]),
    });

    const funde = await kaderSuchen(quelle, {
      team: WASBUETTEL.id,
      spiele: [spiel(5), spiel(4), spiel(3), spiel(2), spiel(1)],
      kinder: [LUMI.personId, MORVO.personId],
    });

    expect(gelesen(funde)).toEqual([
      [5, { [LUMI.personId]: 'Lumi' }],
      [4, undefined],
      [3, { [MORVO.personId]: 'Morvo' }],
    ]);
    expect(quelle.spielbericht).toHaveBeenCalledTimes(3);
  });

  it('reads every Spiel given, two at a time at most, where a Kind is in none', async () => {
    const quelle = data({});
    let laufend = 0;
    let hoechstens = 0;
    quelle.spielbericht.mockImplementation(async () => {
      laufend++;
      hoechstens = Math.max(hoechstens, laufend);
      await new Promise((resolve) => setTimeout(resolve));
      laufend--;
      return undefined;
    });

    await kaderSuchen(quelle, {
      team: WASBUETTEL.id,
      spiele: [spiel(5), spiel(4), spiel(3), spiel(2), spiel(1)],
      kinder: [LUMI.personId],
    });

    expect(quelle.spielbericht).toHaveBeenCalledTimes(5);
    expect(hoechstens).toBe(2);
  });

  it('reads no further after a batch with a failed read', async () => {
    const quelle = data({
      5: bericht(5, []),
      4: new BasketballDataError('offline', 'no network'),
      3: bericht(3, []),
      2: bericht(2, [LUMI]),
    });

    const funde = await kaderSuchen(quelle, {
      team: WASBUETTEL.id,
      spiele: [spiel(5), spiel(4), spiel(3), spiel(2)],
      kinder: [LUMI.personId],
    });

    expect(gelesen(funde)).toEqual([
      [5, {}],
      [3, {}],
    ]);
    expect(funde.unvollstaendig).toBe(true);
    expect(quelle.spielbericht).toHaveBeenCalledTimes(3);
  });

  it('passes over a Spielbericht the DBB does not know, as one not there yet', async () => {
    const quelle = data({
      3: new BasketballDataError('not-found', 'no boxscore'),
      2: new BasketballDataError('not-found', 'no boxscore'),
      1: bericht(1, [LUMI]),
    });

    const funde = await kaderSuchen(quelle, {
      team: WASBUETTEL.id,
      spiele: [spiel(3), spiel(2), spiel(1)],
      kinder: [LUMI.personId],
    });

    expect(gelesen(funde)).toEqual([
      [3, undefined],
      [2, undefined],
      [1, { [LUMI.personId]: 'Lumi' }],
    ]);
    expect(funde.unvollstaendig).toBe(false);
  });

  it('reads every Spiel given where a Kind is in none, and no more', async () => {
    const quelle = data({ 2: bericht(2, [NELKA]), 1: bericht(1, [NELKA]) });

    const funde = await kaderSuchen(quelle, {
      team: WASBUETTEL.id,
      spiele: [spiel(2), spiel(1)],
      kinder: [LUMI.personId],
    });

    expect(gelesen(funde)).toEqual([
      [2, {}],
      [1, {}],
    ]);
    expect(funde.unvollstaendig).toBe(false);
  });

  it("looks only into the Team's own Kader, never the opponent's", async () => {
    const quelle = data({ 2: bericht(2, [], [LUMI]), 1: bericht(1, [LUMI]) });

    const funde = await kaderSuchen(quelle, {
      team: WASBUETTEL.id,
      // the Team plays away in Spiel 1
      spiele: [spiel(2), spiel(1, GIFHORN, WASBUETTEL)],
      kinder: [LUMI.personId],
    });

    expect(gelesen(funde)).toEqual([
      [2, {}],
      [1, {}],
    ]);
  });

  it('reads nothing while no Kind is marked', async () => {
    const quelle = data({});

    const funde = await kaderSuchen(quelle, {
      team: WASBUETTEL.id,
      spiele: [spiel(2)],
      kinder: [],
    });

    expect(funde.spiele.size).toBe(0);
    expect(quelle.spielbericht).not.toHaveBeenCalled();
  });

  it('keeps what the other reads found where one failed, and says the search is incomplete', async () => {
    const quelle = data({
      3: bericht(3, []),
      2: new BasketballDataError('offline', 'no network'),
      1: bericht(1, [LUMI]),
    });

    const funde = await kaderSuchen(quelle, {
      team: WASBUETTEL.id,
      spiele: [spiel(3), spiel(2), spiel(1)],
      kinder: [LUMI.personId],
    });

    expect(gelesen(funde)).toEqual([
      [3, {}],
      [1, { [LUMI.personId]: 'Lumi' }],
    ]);
    expect(funde.unvollstaendig).toBe(true);
  });

  it('reads no further where the last Spiel failed', async () => {
    const quelle = data({
      2: new BasketballDataError('unavailable', 'DBB down'),
      1: bericht(1, [LUMI]),
    });

    const funde = await kaderSuchen(quelle, {
      team: WASBUETTEL.id,
      spiele: [spiel(2), spiel(1)],
      kinder: [LUMI.personId],
    });

    expect(funde.spiele.size).toBe(0);
    expect(funde.unvollstaendig).toBe(true);
    expect(quelle.spielbericht).toHaveBeenCalledTimes(1);
  });

  it('gives up a search that was cancelled', async () => {
    const abbruch = new AbortController();
    const quelle = data({});
    quelle.spielbericht.mockImplementation(async () => {
      abbruch.abort();
      throw new DOMException('aborted', 'AbortError');
    });

    await expect(
      kaderSuchen(
        quelle,
        { team: WASBUETTEL.id, spiele: [spiel(1)], kinder: [LUMI.personId] },
        { signal: abbruch.signal }
      )
    ).rejects.toThrow('aborted');
  });
});
