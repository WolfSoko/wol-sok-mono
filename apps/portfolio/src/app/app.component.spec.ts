import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppComponent } from './app.component';
import { appRoutes } from './app.routes';
import { I18nService } from './i18n/i18n.service';
import { APPS, EXPERIMENTS, PACKAGES } from './projects';
import { SeoService } from './seo.service';

describe('AppComponent', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false }),
    });
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter(appRoutes)],
    });
  });

  it('lists every project on the home page', async () => {
    const harness = await RouterTestingHarness.create('/');
    const text = (harness.routeNativeElement as HTMLElement).textContent;
    for (const project of [...APPS, ...EXPERIMENTS, ...PACKAGES]) {
      expect(text).toContain(project.name);
    }
  });

  it('sets the canonical URL, title and description per page and language', async () => {
    TestBed.inject(SeoService).init();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/privacy');
    const head = document.head;
    expect(
      head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
    ).toBe('https://wolsok.de/privacy');
    expect(
      head.querySelector('meta[name="description"]')?.getAttribute('content')
    ).toContain('Privacy policy');

    await harness.navigateByUrl('/career');
    expect(document.title).toContain('Career');
    TestBed.inject(I18nService).setLanguage('de');
    TestBed.tick();
    expect(document.title).toContain('Werdegang');
    expect(
      head.querySelector('meta[name="description"]')?.getAttribute('content')
    ).toContain('Freiberuflicher');
    localStorage.clear();
  });

  it('switches the language and the theme from the header', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('header .career')?.textContent).toContain(
      'Career'
    );

    root.querySelector<HTMLButtonElement>('.switch button[lang="de"]')?.click();
    await fixture.whenStable();
    expect(root.querySelector('header .career')?.textContent).toContain(
      'Werdegang'
    );
    expect(document.documentElement.lang).toBe('de');

    root.querySelector<HTMLButtonElement>('.theme')?.click();
    await fixture.whenStable();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });
});

describe('sitemap.xml', () => {
  it('lists exactly the routed pages', () => {
    const sitemap = readFileSync(
      join(__dirname, '../../public/sitemap.xml'),
      'utf8'
    );
    const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      ([, loc]) => loc
    );
    const routed = appRoutes
      .filter((route) => route.path !== '**')
      .map((route) => `https://wolsok.de/${route.path}`);
    expect(listed.sort()).toEqual(routed.sort());
  });
});

describe('projects.ts', () => {
  it('links only to pages angular-examples has', () => {
    const sitemap = readFileSync(
      join(__dirname, '../../../angular-examples/src/sitemap.xml'),
      'utf8'
    );
    const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      ([, loc]) => new URL(loc).pathname
    );
    const examplesLinks = [...APPS, ...EXPERIMENTS, ...PACKAGES]
      .flatMap((project) => project.links)
      .map((link) => new URL(link.url))
      .filter((url) => url.host === 'angularexamples.wolsok.de')
      .map((url) => url.pathname.replace(/\/$/, ''));

    // a link may point to a page or to a section that redirects to one of its tabs
    const missing = examplesLinks.filter(
      (path) =>
        path !== '' &&
        !pages.some((page) => page === path || page.startsWith(`${path}/`))
    );
    expect(missing).toEqual([]);
  });
});
