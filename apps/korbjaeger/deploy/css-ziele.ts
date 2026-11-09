/** The minifier's (lightningcss, through Vite) name for each browserslist one. */
const ZIEL_NAME: Readonly<Record<string, string>> = {
  chrome: 'chrome',
  edge: 'edge',
  firefox: 'firefox',
  safari: 'safari',
  ios_saf: 'ios',
};

/**
 * The CSS targets of the build (`build.cssTarget`) from the browsers the
 * workspace's `.browserslistrc` names, the oldest version of each: without
 * them Vite takes `build.target` (`es2020`), and lightningcss polyfills
 * features every supported browser has, `light-dark()` among them, which
 * resolves the colour scheme on `html` alone and so no part of a page
 * (`.anzeigetafel`) can set a scheme of its own.
 */
export function cssZiele(browser: readonly string[]): string[] {
  const aelteste = new Map<string, string>();
  for (const eintrag of browser) {
    const [name, version] = eintrag.split(' ');
    const ziel = ZIEL_NAME[name];
    const erste = version?.split('-')[0];
    if (!ziel || !erste || !/^\d+(\.\d+)*$/.test(erste)) {
      continue;
    }
    const bisher = aelteste.get(ziel);
    if (!bisher || vergleiche(erste, bisher) < 0) {
      aelteste.set(ziel, erste);
    }
  }
  return [...aelteste].map(([ziel, version]) => `${ziel}${version}`).sort();
}

function vergleiche(a: string, b: string): number {
  const teileA = a.split('.').map(Number);
  const teileB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(teileA.length, teileB.length); i++) {
    const unterschied = (teileA[i] ?? 0) - (teileB[i] ?? 0);
    if (unterschied !== 0) {
      return unterschied;
    }
  }
  return 0;
}
