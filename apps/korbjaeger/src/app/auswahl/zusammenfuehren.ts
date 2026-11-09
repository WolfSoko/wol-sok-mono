import type { AuswahlInhalt } from './auswahl-dokument';
import type { Kind } from './kind';

/**
 * What an account holds once the device's choices joined it at sign-in:
 * the account's Teams, then the device's others; the account's Kinder,
 * a missing Spitzname filled from the device's, then the device's others.
 * Each list, and `konto` itself, comes back as it was where the device
 * adds nothing, so a second sign-in with the same choices changes nothing
 * (idempotent).
 */
export function zusammenfuehren(
  konto: AuswahlInhalt,
  geraet: AuswahlInhalt
): AuswahlInhalt {
  const teams = [
    ...konto.teams,
    ...geraet.teams.filter((team) => !konto.teams.includes(team)),
  ];
  const kinder = kinderZusammen(konto.kinder, geraet.kinder);
  if (teams.length === konto.teams.length && kinder === konto.kinder) {
    return konto;
  }
  return {
    teams: teams.length === konto.teams.length ? konto.teams : teams,
    kinder,
  };
}

function kinderZusammen(
  konto: readonly Kind[],
  geraet: readonly Kind[]
): readonly Kind[] {
  const ausGeraet = new Map(geraet.map((kind) => [kind.personId, kind]));
  let geaendert = false;
  const ergaenzt = konto.map((kind) => {
    const spitzname = ausGeraet.get(kind.personId)?.spitzname;
    if (kind.spitzname !== undefined || spitzname === undefined) {
      return kind;
    }
    geaendert = true;
    return { personId: kind.personId, spitzname };
  });
  const imKonto = new Set(konto.map((kind) => kind.personId));
  const neue = geraet.filter((kind) => !imKonto.has(kind.personId));
  return geaendert || neue.length > 0 ? [...ergaenzt, ...neue] : konto;
}
