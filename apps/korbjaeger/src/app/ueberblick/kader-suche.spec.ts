import {
  BasketballDataError,
  type BenannterSpieler,
  type Spiel,
  type Spielbericht,
  type Team,
} from '@wolsok/feat-shared-basketball-data';
import type { KorbjaegerData } from '../basketball-data/basketball-data.provider';
import { gleicherAuftrag, kaderSuchen } from './kader-suche';

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

type BerichtRead = KorbjaegerData['spielbericht'];

/** Answers each Spiel's Spielbericht from `berichte`; one not listed has none. */
function data(berichte: Readonly<Record<number, Spielbericht | Error>>): {
  readonly spielbericht: ReturnType<typeof vi.fn<BerichtRead>>;
} {
  return {
    spielbericht: vi.fn<BerichtRead>(async (spielId) => {
      const antwort = berichte[spielId];
      if (antwort instanceof Error) {
        throw antwort;
      }
      return antwort;
    }),
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

  it('reads on, newest first, until each Kind was found', async () => {
    const quelle = data({
      3: bericht(3, [LUMI]),
      1: bericht(1, [MORVO]),
    });

    const funde = await kaderSuchen(quelle, {
      team: WASBUETTEL.id,
      spiele: [spiel(3), spiel(2), spiel(1), spiel(0)],
      kinder: [LUMI.personId, MORVO.personId],
    });

    expect(gelesen(funde)).toEqual([
      [3, { [LUMI.personId]: 'Lumi' }],
      [2, undefined],
      [1, { [MORVO.personId]: 'Morvo' }],
    ]);
    expect(quelle.spielbericht).toHaveBeenCalledTimes(3);
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

  it('stops at a read that failed and says the search is incomplete', async () => {
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

    expect(gelesen(funde)).toEqual([[3, {}]]);
    expect(funde.unvollstaendig).toBe(true);
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

describe('gleicherAuftrag', () => {
  const auftrag = {
    team: WASBUETTEL.id,
    spiele: [spiel(2), spiel(1)],
    kinder: [LUMI.personId],
  };

  it('takes an order for the same Spiele and Kinder as the same', () => {
    expect(
      gleicherAuftrag(auftrag, { ...auftrag, spiele: [spiel(2), spiel(1)] })
    ).toBe(true);
  });

  it.each([
    ['another Team', { ...auftrag, team: GIFHORN.id }],
    ['another Spiel', { ...auftrag, spiele: [spiel(3), spiel(2)] }],
    ['another Kind', { ...auftrag, kinder: [LUMI.personId, MORVO.personId] }],
    ['none', undefined],
  ])('tells an order for %s apart', (_fall, anderer) => {
    expect(gleicherAuftrag(auftrag, anderer)).toBe(false);
  });
});
