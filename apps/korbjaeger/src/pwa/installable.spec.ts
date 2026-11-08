// @vitest-environment node
import { existsSync, readFileSync } from 'node:fs';

/** A file of the app, as the build ships it or the deploy reads it. */
function appFile(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
}

interface ManifestIcon {
  readonly src: string;
  readonly sizes: string;
  readonly type: string;
  readonly purpose?: string;
}

interface Manifest {
  readonly id: string;
  readonly name: string;
  readonly short_name: string;
  readonly lang: string;
  readonly start_url: string;
  readonly scope: string;
  readonly display: string;
  readonly theme_color: string;
  readonly background_color: string;
  readonly icons: readonly ManifestIcon[];
}

const manifest = JSON.parse(
  appFile('src/public/manifest.webmanifest')
) as Manifest;
const indexHtml = appFile('index.html');

/** Whether a file the build serves at `src` lies in the public folder. */
function served(src: string): boolean {
  return existsSync(new URL(`../public/${src}`, import.meta.url));
}

describe('installing the app', () => {
  it('is named Korbjäger, in German, and opens on the overview in a window of its own', () => {
    expect(manifest).toMatchObject({
      id: '/',
      name: 'Korbjäger',
      short_name: 'Korbjäger',
      lang: 'de',
      start_url: '/',
      scope: '/',
      display: 'standalone',
    });
  });

  it('has the icons a phone asks for, maskable too, each served by the build', () => {
    const png = (size: number, purpose?: string) =>
      manifest.icons.find(
        (icon) =>
          icon.type === 'image/png' &&
          icon.sizes === `${size}x${size}` &&
          icon.purpose === purpose
      );

    expect(png(192)).toBeDefined();
    expect(png(512)).toBeDefined();
    expect(png(512, 'maskable')).toBeDefined();
    for (const icon of manifest.icons) {
      expect(served(icon.src)).toBe(true);
    }
  });

  it("takes the theme's orange, as the page does", () => {
    expect(manifest.theme_color).toBe('#e37100');
    expect(indexHtml).toContain(
      `<meta name="theme-color" content="${manifest.theme_color}" />`
    );
  });

  it('links the manifest, the icons and the iOS icon from the shell', () => {
    expect(indexHtml).toContain(
      '<link rel="manifest" href="/manifest.webmanifest" />'
    );
    for (const href of [
      '/favicon.ico',
      '/icons/icon.svg',
      '/icons/apple-touch-icon.png',
    ]) {
      expect(indexHtml).toContain(`href="${href}"`);
      expect(served(href.slice(1))).toBe(true);
    }
  });

  it('has its icons drawn by a script, never by hand', () => {
    const project = JSON.parse(appFile('project.json')) as {
      targets: Record<string, { options: { command?: string } }>;
    };
    const command = project.targets['icons']?.options.command;

    expect(command).toBe('tsx ./tools/korbjaeger/generate-icons.ts');
    expect(
      existsSync(
        new URL(
          '../../../../tools/korbjaeger/generate-icons.ts',
          import.meta.url
        )
      )
    ).toBe(true);
  });
});
