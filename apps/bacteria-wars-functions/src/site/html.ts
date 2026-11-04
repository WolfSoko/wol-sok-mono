import { inLang } from '@wolsok/feat-shared-bacteria-engine';
import { type Lang, t, type Word } from './texts';

/** Text for HTML, in an element or an attribute. */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] ?? char
  );
}

/** JSON for a `<script>`: `</` can never close it. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * A page's path in a language: the game's own rule, which its links to
 * these pages follow too.
 */
export { inLang } from '@wolsok/feat-shared-bacteria-engine';

/** A word of the pages, escaped. */
export function text(
  lang: Lang,
  word: Word,
  params?: Readonly<Record<string, string>>
): string {
  return escapeHtml(t(lang, word, params));
}

/** A link to a page in a language, escaped for the attribute. */
export function href(
  path: string,
  lang: Lang,
  params?: Readonly<Record<string, string>>
): string {
  return escapeHtml(inLang(path, lang, params));
}
