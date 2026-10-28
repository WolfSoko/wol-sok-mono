/** The languages the site speaks. */
export type Language = 'en' | 'de';

/** Each language under its own name, as the language switch shows it. */
export const LANGUAGES: readonly { id: Language; name: string }[] = [
  { id: 'en', name: 'English' },
  { id: 'de', name: 'Deutsch' },
];

/** The locale each language formats numbers and dates in. */
export const LOCALES: Readonly<Record<Language, string>> = {
  en: 'en-GB',
  de: 'de-DE',
};

/** A text in every language the site speaks. */
export type Localized<T = string> = Readonly<Record<Language, T>>;

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language.id === value);
}

/**
 * The language for the browser's preferred ones (`navigator.languages`):
 * German if the first of them is, English for everything else.
 */
export function detectLanguage(languages: readonly string[]): Language {
  return languages[0]?.toLowerCase().startsWith('de') ? 'de' : 'en';
}
