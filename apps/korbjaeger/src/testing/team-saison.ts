import type {
  Spiel,
  SpielStatus,
  TeamSaison,
} from '@wolsok/feat-shared-basketball-data';

/** MTV Wasbüttel's U12 Team, as the fixtures name it. */
export const WASBUETTEL_RST = {
  id: 313036,
  name: 'MTV Wasbüttel -RST-',
  vereinId: 1837,
};
const GIFHORN = { id: 201500, name: 'MTV Gifhorn', vereinId: 201500 };

/** A result, confirmed. */
export const PLAYED: SpielStatus = {
  art: 'gespielt',
  ergebnis: { heim: 78, gast: 47 },
  bestaetigt: true,
};

/** A Spiel of `WASBUETTEL_RST` at home against MTV Gifhorn. */
export function spielOn(
  id: number,
  datum: string,
  status: SpielStatus = PLAYED
): Spiel {
  return {
    id,
    ligaId: 54862,
    spieltag: 1,
    datum,
    heim: { art: 'team', team: WASBUETTEL_RST },
    gast: { art: 'team', team: GIFHORN },
    status,
  };
}

/** `WASBUETTEL_RST`'s Saison with `spiele`, in date order. */
export function saisonOf(...spiele: Spiel[]): TeamSaison {
  return {
    team: WASBUETTEL_RST,
    verein: { id: 1837, name: 'MTV Wasbüttel' },
    ligen: [],
    spiele,
  };
}
