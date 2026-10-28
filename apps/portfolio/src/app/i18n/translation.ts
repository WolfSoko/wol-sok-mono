/** The texts of an area, nested by screen and topic. */
export interface Dictionary {
  readonly [key: string]: string | Dictionary;
}

/**
 * The shape another language owes the English texts of an area: the same
 * keys, each a string where the English one is. A missing or an extra key
 * fails to compile.
 */
export type Translation<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : Translation<T[K]>;
};

/** The values a text's `{name}` placeholders are filled with. */
export type TranslationParams = Readonly<Record<string, string | number>>;

/**
 * Fills the `{name}` placeholders of a text, numbers formatted for the
 * locale. A placeholder without a value stays as it is, so the gap shows.
 */
export function fill(
  text: string,
  locale: string,
  params: TranslationParams = {}
): string {
  return text.replace(/\{(\w+)\}/g, (placeholder, name: string) => {
    const value = params[name];
    if (value === undefined) {
      return placeholder;
    }
    return typeof value === 'number' ? value.toLocaleString(locale) : value;
  });
}
