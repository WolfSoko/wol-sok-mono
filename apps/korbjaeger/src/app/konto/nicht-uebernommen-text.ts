import {
  AUSWAHL_GRENZEN,
  type AuswahlListe,
} from '../auswahl/auswahl-dokument';
import type { NichtUebernommen } from '../auswahl/zusammenfuehren';

/** How the text names `anzahl` entries of each list, and the list's cap. */
const WIE_GENANNT: Readonly<Record<AuswahlListe, (anzahl: number) => string>> =
  {
    teams: (anzahl) => (anzahl === 1 ? '1 Team' : `${anzahl} Teams`),
    kinder: (anzahl) => (anzahl === 1 ? '1 Kind' : `${anzahl} Kinder`),
    vereinsfarben: (anzahl) =>
      anzahl === 1
        ? 'die Farben eines Vereins'
        : `die Farben von ${anzahl} Vereinen`,
  };

/**
 * What the settings say of the device's choices that did not fit, with the
 * caps of the lists that overflowed; none where all did.
 */
export function nichtUebernommenText(
  uebrig: NichtUebernommen
): string | undefined {
  const voll = (Object.keys(WIE_GENANNT) as AuswahlListe[]).filter(
    (liste) => uebrig[liste].length > 0
  );
  if (voll.length === 0) {
    return undefined;
  }
  const was = aufgezaehlt(
    voll.map((liste) => WIE_GENANNT[liste](uebrig[liste].length))
  );
  const grenzen = aufgezaehlt(
    voll.map((liste) => WIE_GENANNT[liste](AUSWAHL_GRENZEN[liste]))
  );
  // one Team or one Kind alone is singular; Farben are plural
  const einzeln =
    voll.length === 1 &&
    voll[0] !== 'vereinsfarben' &&
    uebrig[voll[0]].length === 1;
  return `${gross(was)} dieses Geräts ${einzeln ? 'passte' : 'passten'} nicht mehr in dein Konto: Es hält höchstens ${grenzen}.`;
}

/** `a`, `a und b`, `a, b und c`. */
function aufgezaehlt(teile: readonly string[]): string {
  return teile.length < 2
    ? teile.join('')
    : `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}

function gross(satz: string): string {
  return `${satz[0].toUpperCase()}${satz.slice(1)}`;
}
