import {
  SELECTION_LIMITS,
  SELECTION_LISTS,
  type SelectionList,
  type NotTakenOver,
} from '@wolsok/feat-korbjaeger-selection';

/** How the text names `count` entries of a list, and whether that is singular. */
const AS_NAMED: Readonly<
  Record<SelectionList, (count: number) => { text: string; singular: boolean }>
> = {
  teams: (count) => ({
    text: count === 1 ? '1 Team' : `${count} Teams`,
    singular: count === 1,
  }),
  children: (count) => ({
    text: count === 1 ? '1 Kind' : `${count} Kinder`,
    singular: count === 1,
  }),
  // "die Farben" are plural, however many Vereine
  clubColors: (count) => ({
    text:
      count === 1
        ? 'die Farben eines Vereins'
        : `die Farben von ${count} Vereinen`,
    singular: false,
  }),
};

/** `a`, `a und b`, `a, b und c`. */
const ENUMERATION = new Intl.ListFormat('de', { type: 'conjunction' });

/**
 * What the settings say of the device's choices that did not fit, with the
 * caps of the lists that overflowed; none where all did.
 */
export function notTakenOverText(leftOver: NotTakenOver): string | undefined {
  const full = SELECTION_LISTS.filter((list) => leftOver[list].length > 0);
  if (full.length === 0) {
    return undefined;
  }
  const what = full.map((list) => AS_NAMED[list](leftOver[list].length));
  const limits = full.map(
    (list) => AS_NAMED[list](SELECTION_LIMITS[list]).text
  );
  const sentence = ENUMERATION.format(what.map(({ text }) => text));
  const fitted = what.length === 1 && what[0].singular ? 'passte' : 'passten';
  return `${sentence[0].toUpperCase()}${sentence.slice(1)} dieses Geräts ${fitted} nicht mehr in dein Konto: Es hält höchstens ${ENUMERATION.format(limits)}.`;
}
