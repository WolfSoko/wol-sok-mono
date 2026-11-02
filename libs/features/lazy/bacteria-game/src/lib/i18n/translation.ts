/**
 * A text that depends on a count: `one` for a single thing, `other` for
 * the rest, picked with `Intl.PluralRules` for the active language. Its
 * `count` param fills `{count}`.
 */
export interface Plural {
  readonly one: string;
  readonly other: string;
}

/** One translated text: plain, with `{name}` placeholders, or a plural. */
export type Entry = string | Plural;

/** The texts of an area, nested by screen and topic. */
export interface Dictionary {
  readonly [key: string]: Entry | Dictionary;
}

/**
 * The shape another language owes the English texts of an area: the same
 * keys, each a string or a plural where the English one is. A missing or an
 * extra key fails to compile.
 */
export type Translation<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Plural
      ? Plural
      : Translation<T[K]>;
};

/** Every dotted path to a text in a dictionary, plurals included. */
export type EntryPath<T> = {
  [K in keyof T & string]: T[K] extends Entry ? K : `${K}.${EntryPath<T[K]>}`;
}[keyof T & string];

/** The values a text's placeholders are filled with. */
export type TranslationParams = Readonly<Record<string, string | number>>;

/** The entry at a dotted path, undefined where there is none. */
export function lookUp(
  dictionary: Dictionary,
  path: string
): Entry | undefined {
  let node: Entry | Dictionary | undefined = dictionary;
  for (const key of path.split('.')) {
    if (node === undefined || typeof node === 'string' || isPlural(node)) {
      return undefined;
    }
    node = (node as Dictionary)[key];
  }
  return node === undefined || typeof node === 'string' || isPlural(node)
    ? node
    : undefined;
}

/**
 * The text at `path`, from `dictionary` or else from `fallback` - the key
 * itself where neither has it, so the gap shows instead of breaking.
 */
export function translate(
  dictionary: Dictionary,
  fallback: Dictionary,
  path: string,
  locale: string,
  params?: TranslationParams
): string {
  const entry = lookUp(dictionary, path) ?? lookUp(fallback, path);
  return entry === undefined ? path : format(entry, locale, params);
}

/**
 * Turns an entry into the text to show: picks the plural form for `count`
 * and fills the `{name}` placeholders, numbers formatted for the locale. A
 * placeholder without a value stays as it is, so the gap shows.
 */
export function format(
  entry: Entry,
  locale: string,
  params: TranslationParams = {}
): string {
  const text =
    typeof entry === 'string'
      ? entry
      : entry[pluralForm(locale, Number(params['count'] ?? 0))];
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    if (value === undefined) {
      return placeholder;
    }
    return typeof value === 'number' ? value.toLocaleString(locale) : value;
  });
}

function pluralForm(locale: string, count: number): keyof Plural {
  return new Intl.PluralRules(locale).select(count) === 'one' ? 'one' : 'other';
}

function isPlural(node: Entry | Dictionary): node is Plural {
  return (
    typeof node === 'object' &&
    typeof node['one'] === 'string' &&
    typeof node['other'] === 'string'
  );
}
