import type { Engine } from '../engine';

/**
 * Words no public name may contain, in English and German (ADR 0011). A
 * name with one falls back to the colour label - a false hit costs only
 * the name, so the list errs on the strict side. Matched on the name
 * lower-cased, with common look-alike digits and signs read as letters and
 * everything but letters removed.
 */
const BLOCKED = [
  // English
  'fuck',
  'shit',
  'cunt',
  'bitch',
  'whore',
  'slut',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'rapist',
  'penis',
  'vagina',
  'pussy',
  'asshole',
  'wanker',
  'nazi',
  'hitler',
  'kkk',
  // German
  'fotze',
  'hure',
  'nutte',
  'wichser',
  'schlampe',
  'arschloch',
  'hurensohn',
  'schwuchtel',
  'neger',
  'kanake',
  'missgeburt',
  'spast',
  'ficken',
  'fick',
  'schwanz',
  'muschi',
  'siegheil',
];

const LOOK_ALIKES: Readonly<Record<string, string>> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
};

/** The name as the blocklist reads it. */
function folded(name: string): string {
  return name
    .toLowerCase()
    .replace(/./gu, (char) => LOOK_ALIKES[char] ?? char)
    .replace(/[^a-z]/g, '');
}

/** True when the name contains a blocked word. */
export function isBlockedName(name: string): boolean {
  const text = folded(name);
  return BLOCKED.some((word) => text.includes(word));
}

/**
 * The name a player shows in public, snapshotted from their profile: only
 * with `publicName: true`, never a blocked one or one that copies a label
 * ("Anonymous #4821", "Player 0042") - null otherwise.
 */
export function publicNameOf(
  engine: Pick<Engine, 'posesAsLabel' | 'NAME_MAX'>,
  profile: Record<string, unknown> | undefined
): string | null {
  const name = profile?.['name'];
  if (
    profile?.['publicName'] !== true ||
    typeof name !== 'string' ||
    name.trim() === '' ||
    isBlockedName(name) ||
    engine.posesAsLabel(name)
  ) {
    return null;
  }
  return name.trim().slice(0, engine.NAME_MAX);
}
