import {
  SELECTION_LIMITS,
  SELECTION_LISTS,
  type SelectionList,
  type NotTakenOver,
} from '@wolsok/feat-korbjaeger-selection';

/** How the text names `anzahl` entries of a list, and whether that is singular. */
const WIE_GENANNT: Readonly<
  Record<SelectionList, (anzahl: number) => { text: string; einzahl: boolean }>
> = {
  teams: (anzahl) => ({
    text: anzahl === 1 ? '1 Team' : `${anzahl} Teams`,
    einzahl: anzahl === 1,
  }),
  children: (anzahl) => ({
    text: anzahl === 1 ? '1 Kind' : `${anzahl} Kinder`,
    einzahl: anzahl === 1,
  }),
  // "die Farben" are plural, however many Vereine
  clubColors: (anzahl) => ({
    text:
      anzahl === 1
        ? 'die Farben eines Vereins'
        : `die Farben von ${anzahl} Vereinen`,
    einzahl: false,
  }),
};

/** `a`, `a und b`, `a, b und c`. */
const AUFZAEHLUNG = new Intl.ListFormat('de', { type: 'conjunction' });

/**
 * What the settings say of the device's choices that did not fit, with the
 * caps of the lists that overflowed; none where all did.
 */
export function nichtUebernommenText(uebrig: NotTakenOver): string | undefined {
  const voll = SELECTION_LISTS.filter((liste) => uebrig[liste].length > 0);
  if (voll.length === 0) {
    return undefined;
  }
  const was = voll.map((liste) => WIE_GENANNT[liste](uebrig[liste].length));
  const grenzen = voll.map(
    (liste) => WIE_GENANNT[liste](SELECTION_LIMITS[liste]).text
  );
  const satz = AUFZAEHLUNG.format(was.map(({ text }) => text));
  const passte = was.length === 1 && was[0].einzahl ? 'passte' : 'passten';
  return `${satz[0].toUpperCase()}${satz.slice(1)} dieses Geräts ${passte} nicht mehr in dein Konto: Es hält höchstens ${AUFZAEHLUNG.format(grenzen)}.`;
}
