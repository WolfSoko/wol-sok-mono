/** The AdSense script `index.html` loads on every page. */
export const AD_SCRIPT_SELECTOR =
  'script[src^="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]';

/**
 * Takes the AdSense script out of the page, so a page without content (the
 * not-found page) shows no ads, as AdSense requires. Run during prerendering,
 * it keeps the script out of that page's HTML; the account's meta tag stays.
 */
export function removeAdScript(document: Document): void {
  document.querySelectorAll(AD_SCRIPT_SELECTOR).forEach((script) => {
    script.remove();
  });
}
