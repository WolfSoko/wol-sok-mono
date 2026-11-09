import { AUSWAHL_GRENZEN } from '../auswahl/auswahl-dokument';
import type { NichtUebernommen } from '../auswahl/zusammenfuehren';

/** What the settings say of the device's choices that did not fit; none where all did. */
export function nichtUebernommenText(
  uebrig: NichtUebernommen
): string | undefined {
  const teams = uebrig.teams.length;
  const kinder = uebrig.kinder.length;
  const vereine = uebrig.vereinsfarben.length;
  const teile = [
    teams === 1 ? '1 Team' : teams > 1 ? `${teams} Teams` : undefined,
    kinder === 1 ? '1 Kind' : kinder > 1 ? `${kinder} Kinder` : undefined,
    vereine === 1
      ? 'die Farben eines Vereins'
      : vereine > 1
        ? `die Farben von ${vereine} Vereinen`
        : undefined,
  ].filter((teil) => teil !== undefined);
  if (teile.length === 0) {
    return undefined;
  }
  // only one Team or one Kind is singular: Farben are plural
  const passten = teams + kinder === 1 && vereine === 0 ? 'passte' : 'passten';
  const satz = aufgezaehlt(teile);
  return `${satz[0].toUpperCase()}${satz.slice(1)} dieses Geräts ${passten} nicht mehr in dein Konto: Es hält höchstens ${AUSWAHL_GRENZEN.teams} Teams, ${AUSWAHL_GRENZEN.kinder} Kinder und die Farben von ${AUSWAHL_GRENZEN.vereinsfarben} Vereinen.`;
}

/** `a`, `a und b`, `a, b und c`. */
function aufgezaehlt(teile: readonly string[]): string {
  return teile.length < 2
    ? teile.join('')
    : `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}
