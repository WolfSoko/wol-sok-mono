import { signal } from '@angular/core';
import type {
  KaderFunde,
  SpielDetails,
  TeamSaison,
  TeamUeberblick,
  VereinId,
  VereinsTeams,
} from '@wolsok/feat-shared-basketball-data';
import {
  fakeDatenResource,
  type FakeLesung,
} from '../../testing/fake-daten-resource';
import type { Stand } from '../basketball-data/stand';
import { NICHT_LESBAR } from './kader-funde';
import { teamImUeberblick } from './team-im-ueberblick';
import type { TeamLesungen } from './team-lesungen';

const TEAM = 313036;
const VEREIN: VereinId = 1837;

const SAISON: TeamSaison = {
  team: { id: TEAM, name: 'MTV Wasbüttel', vereinId: VEREIN },
  verein: { id: VEREIN, name: 'MTV Wasbüttel' },
  ligen: [],
  spiele: [],
};

const UEBERBLICK: TeamUeberblick = { ausfaelle: [] };

const FUNDE: KaderFunde = {
  spiele: new Map([[3, new Map([[4711, 'Lumi']])]]),
  unvollstaendig: false,
};

const ALT: Stand = { gespeichertAm: 1000, grund: 'kein-internet' };
const AELTER: Stand = { gespeichertAm: 500, grund: 'unavailable' };

interface Lesungen {
  readonly saison?: FakeLesung<TeamSaison>;
  readonly kaderSuche?: FakeLesung<KaderFunde>;
  readonly funde?: KaderFunde;
  readonly saisonEndeVerein?: VereinId;
}

/** A Team's reads as `lesungen` shows them; its Saison read, by default. */
function lesung({
  saison = { status: 'resolved', value: SAISON },
  kaderSuche = { status: 'idle' },
  funde,
  saisonEndeVerein,
}: Lesungen = {}): TeamLesungen {
  return {
    saison: fakeDatenResource(saison),
    ueberblick: signal(saison.value && UEBERBLICK),
    naechsteDetails: fakeDatenResource<SpielDetails>({ status: 'idle' }),
    kaderSuche: fakeDatenResource(kaderSuche),
    funde: signal(funde),
    saisonEndeVerein: signal(saisonEndeVerein),
  };
}

const keineVereine = () => undefined;

describe('teamImUeberblick', () => {
  it('shows a Team just followed as loading, searched where a Kind is marked', () => {
    expect(teamImUeberblick(TEAM, undefined, keineVereine, true)).toEqual({
      karte: { art: 'laedt', teamId: TEAM },
      sucht: true,
    });
    expect(teamImUeberblick(TEAM, undefined, keineVereine, false).sucht).toBe(
      false
    );
  });

  it('shows a Team whose Saison is still read as loading', () => {
    const laedt = lesung({ saison: { status: 'loading' } });

    expect(teamImUeberblick(TEAM, laedt, keineVereine, false).karte).toEqual({
      art: 'laedt',
      teamId: TEAM,
    });
  });

  it('ends the search of a Team whose Saison failed, unable to tell', () => {
    const gescheitert = lesung({
      saison: { status: 'error', error: new Error('offline') },
    });

    const mitKindern = teamImUeberblick(TEAM, gescheitert, keineVereine, true);
    const ohne = teamImUeberblick(TEAM, gescheitert, keineVereine, false);

    expect(mitKindern.karte.art).toBe('fehler');
    expect(mitKindern.funde).toBe(NICHT_LESBAR);
    expect(mitKindern.sucht).toBe(false);
    expect(ohne.funde).toBeUndefined();
  });

  it('gives a read Team its card and Saison, and its finds only where a Kind is marked', () => {
    const gelesen = lesung({
      kaderSuche: { status: 'resolved', value: FUNDE },
      funde: FUNDE,
    });

    const mitKindern = teamImUeberblick(TEAM, gelesen, keineVereine, true);
    const ohne = teamImUeberblick(TEAM, gelesen, keineVereine, false);

    expect(mitKindern.karte).toMatchObject({
      art: 'geladen',
      teamId: TEAM,
      name: 'MTV Wasbüttel',
      saisonBeendet: false,
    });
    expect(mitKindern.saison).toEqual({
      saison: SAISON,
      ueberblick: UEBERBLICK,
    });
    expect(mitKindern.funde).toBe(FUNDE);
    expect(mitKindern.sucht).toBe(false);
    expect(ohne.funde).toBeUndefined();
    expect(ohne.sucht).toBe(false);
  });

  it('says a Team is still searched while its search runs', () => {
    const sucht = lesung({ kaderSuche: { status: 'loading' } });

    expect(teamImUeberblick(TEAM, sucht, keineVereine, true).sucht).toBe(true);
  });

  it("reads its Verein's Teams only once its Saison looks over", () => {
    const vereinsTeamsVon = vi.fn(keineVereine);

    teamImUeberblick(TEAM, lesung(), vereinsTeamsVon, false);
    const beendet = teamImUeberblick(
      TEAM,
      lesung({ saisonEndeVerein: VEREIN }),
      vereinsTeamsVon,
      false
    );

    expect(vereinsTeamsVon).toHaveBeenCalledExactlyOnceWith(VEREIN);
    expect(beendet.karte).toMatchObject({ saisonBeendet: true });
  });

  it("dates the card by its Verein's Teams too, the Team itself by its own reads", () => {
    const vereinsTeams = fakeDatenResource<VereinsTeams>({
      status: 'resolved',
      value: { verein: SAISON.verein, teams: [] },
      stand: AELTER,
    });

    const team = teamImUeberblick(
      TEAM,
      lesung({
        saison: { status: 'resolved', value: SAISON, stand: ALT },
        saisonEndeVerein: VEREIN,
      }),
      () => vereinsTeams,
      false
    );

    expect(team.karte).toMatchObject({ stand: AELTER });
    expect(team.stand).toBe(ALT);
  });
});
