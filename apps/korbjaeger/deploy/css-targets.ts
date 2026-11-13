/** The minifier's (lightningcss, through Vite) name for each browserslist one. */
const TARGET_NAME: Readonly<Record<string, string>> = {
  chrome: 'chrome',
  edge: 'edge',
  firefox: 'firefox',
  safari: 'safari',
  ios_saf: 'ios',
  opera: 'opera',
};

/**
 * The CSS targets of the build (`build.cssTarget`) from the browsers the
 * workspace's `.browserslistrc` names, the oldest version of each: without
 * them Vite takes `build.target` (`es2020`), and lightningcss polyfills
 * features every supported browser has, `light-dark()` among them, which
 * resolves the colour scheme on `html` alone and so no part of a page
 * (`.anzeigetafel`) can set a scheme of its own.
 */
export function cssTargets(browser: readonly string[]): string[] {
  const oldest = new Map<string, string>();
  for (const entry of browser) {
    const [name, version] = entry.split(' ');
    const target = TARGET_NAME[name];
    const first = version?.split('-')[0];
    if (!target || !first || !/^\d+(\.\d+)*$/.test(first)) {
      continue;
    }
    const current = oldest.get(target);
    if (!current || compare(first, current) < 0) {
      oldest.set(target, first);
    }
  }
  return [...oldest].map(([target, version]) => `${target}${version}`).sort();
}

function compare(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const difference = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
