import type {
  Kader,
  KaderEintrag,
  Spielbericht,
  Spielerwerte,
} from '../domain/spielbericht';
import { DbbObject } from './dbb-object';
import { optionalField } from './optional-field';

/** The shirt number the DBB lists for every player where it has none. */
const NO_SHIRT_NUMBER = '0';

/**
 * A Spiel's Spielbericht (`match/id/{id}/boxscore`), or `undefined` while
 * the DBB has none (no Kader listed). Where every number is 0, the Verband
 * records no Spielerwerte: the Spielbericht says so and its entries carry
 * none, rather than zeros.
 */
export function mapSpielbericht(data: unknown): Spielbericht | undefined {
  const match = DbbObject.of(data, 'boxscore');
  const boxscore = match.optionalObject('matchBoxscore');
  const heim = boxscore?.optionalObjects('homePlayerStats') ?? [];
  const gast = boxscore?.optionalObjects('guestPlayerStats') ?? [];
  if (heim.length === 0 && gast.length === 0) {
    return undefined;
  }
  const kader = { heim: mapKader(heim), gast: mapKader(gast) };
  const spielerwerteErfasst = [...kader.heim, ...kader.gast].some(
    (eintrag) =>
      eintrag.spielerwerte !== undefined && hatWerte(eintrag.spielerwerte)
  );
  return {
    spielId: match.number('matchId'),
    spielerwerteErfasst,
    heim: spielerwerteErfasst ? kader.heim : ohneSpielerwerte(kader.heim),
    gast: spielerwerteErfasst ? kader.gast : ohneSpielerwerte(kader.gast),
  };
}

/** Each row mapped once, with the numbers as the DBB lists them. */
function mapKader(playerStats: readonly DbbObject[]): Kader {
  const nummern = nummernErfasst(playerStats);
  return playerStats.map((stats) => mapEintrag(stats, nummern));
}

/** The Kader of a Verband that records no Spielerwerte: none, not zeros. */
function ohneSpielerwerte(kader: Kader): Kader {
  return kader.map(({ spielerwerte: _keine, ...eintrag }) => eintrag);
}

/** Whether the Kader lists shirt numbers: not where every named player has 0. */
function nummernErfasst(playerStats: readonly DbbObject[]): boolean {
  return playerStats
    .map((stats) => stats.object('player'))
    .filter((player) => !istAnonym(player, player.object('person')))
    .some(
      (player) =>
        (player.optionalString('no') ?? NO_SHIRT_NUMBER) !== NO_SHIRT_NUMBER
    );
}

function mapEintrag(stats: DbbObject, nummernErfasst: boolean): KaderEintrag {
  const player = stats.object('player');
  const person = player.object('person');
  const spielerwerte = mapSpielerwerte(stats);
  if (istAnonym(player, person)) {
    return { art: 'anonym', spielerwerte };
  }
  const nummer = player.optionalString('no')?.trim();
  return {
    art: 'benannt',
    personId: person.number('id'),
    vorname: person.string('vorname').trim(),
    nachname: person.string('nachname').trim(),
    ...optionalField(
      'trikotnummer',
      nummernErfasst && nummer ? nummer : undefined
    ),
    spielerwerte,
  };
}

/** The DBB hides a player with `anonym` and person id 0. */
function istAnonym(player: DbbObject, person: DbbObject): boolean {
  return (
    player.optionalBoolean('anonym') ||
    person.optionalBoolean('anonym') ||
    person.optionalNumber('id') === 0
  );
}

function mapSpielerwerte(stats: DbbObject): Spielerwerte {
  const freiwuerfe = stats.optionalObject('onePoints');
  return {
    punkte: zahl(stats, 'pts'),
    zweier: treffer(stats.optionalObject('twoPoints')),
    dreier: treffer(stats.optionalObject('threePoints')),
    freiwuerfe: {
      getroffen: treffer(freiwuerfe),
      versucht: freiwuerfe === undefined ? 0 : zahl(freiwuerfe, 'attempted'),
    },
    fouls: zahl(stats, 'fouls'),
  };
}

function hatWerte(werte: Spielerwerte): boolean {
  return [
    werte.punkte,
    werte.zweier,
    werte.dreier,
    werte.freiwuerfe.getroffen,
    werte.freiwuerfe.versucht,
    werte.fouls,
  ].some((wert) => wert !== 0);
}

function treffer(wurf: DbbObject | undefined): number {
  return wurf === undefined ? 0 : zahl(wurf, 'made');
}

function zahl(object: DbbObject, key: string): number {
  return object.optionalNumber(key) ?? 0;
}
