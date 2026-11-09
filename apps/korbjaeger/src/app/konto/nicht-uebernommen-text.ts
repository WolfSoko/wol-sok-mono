import { AUSWAHL_GRENZEN } from '../auswahl/auswahl-dokument';
import type { NichtUebernommen } from '../auswahl/zusammenfuehren';

/** What the settings say of the device's choices that did not fit; none where all did. */
export function nichtUebernommenText(
  uebrig: NichtUebernommen
): string | undefined {
  const teams = uebrig.teams.length;
  const kinder = uebrig.kinder.length;
  const teile = [
    teams === 1 ? '1 Team' : teams > 1 ? `${teams} Teams` : undefined,
    kinder === 1 ? '1 Kind' : kinder > 1 ? `${kinder} Kinder` : undefined,
  ].filter((teil) => teil !== undefined);
  if (teile.length === 0) {
    return undefined;
  }
  const passten = teams + kinder === 1 ? 'passte' : 'passten';
  return `${teile.join(' und ')} dieses Geräts ${passten} nicht mehr in dein Konto: Es hält höchstens ${AUSWAHL_GRENZEN.teams} Teams und ${AUSWAHL_GRENZEN.kinder} Kinder.`;
}
