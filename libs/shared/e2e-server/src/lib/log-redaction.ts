/**
 * What an e2e test may print about the page into a CI log, which is public
 * on Nx Cloud: a URL keeps its origin and path, never credentials, query or
 * hash, since tokens and ids travel there.
 */

/** An http(s) or ws(s) URL inside a text, up to the next whitespace. */
const URL_IN_TEXT = /\b(?:https?|wss?):\/\/\S+/gi;

/** Credentials, query and hash of a URL `new URL` refused. */
const CREDENTIALS = /\/\/[^/@]*@/;
const QUERY_OR_HASH = /[?#].*$/;

/** `url` without credentials, query and hash. */
export function urlForLog(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.href;
  } catch {
    return url.replace(QUERY_OR_HASH, '').replace(CREDENTIALS, '//');
  }
}

/** `text` with every URL in it reduced as `urlForLog` does. */
export function redactUrls(text: string): string {
  return text.replace(URL_IN_TEXT, urlForLog);
}
