import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTheme } from '@wolsok/shared-theme';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AD_SCRIPT_SELECTOR } from './ad-script';
import { AppComponent } from './app.component';
import { appRoutes, HOME_PAGE } from './app.routes';
import { BLOG_POSTS } from './blog/posts';
import { CAREER_PROFILE } from './career/career.data';
import { I18nService } from './i18n/i18n.service';
import { LANGUAGES, Localized } from './i18n/language';
import { APPS, EXPERIMENTS, PACKAGES } from './projects';
import { SeoService } from './seo.service';
import { PORTFOLIO_THEME } from './theme/theme';

describe('AppComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter(appRoutes), provideTheme(PORTFOLIO_THEME)],
    });
  });

  afterEach(() => localStorage.clear());

  it('lists every project on the home page', async () => {
    const harness = await RouterTestingHarness.create('/');
    const text = (harness.routeNativeElement as HTMLElement).textContent;
    for (const project of [...APPS, ...EXPERIMENTS, ...PACKAGES]) {
      expect(text).toContain(project.name);
    }
  });

  it('teases the newest article on the home page', async () => {
    const harness = await RouterTestingHarness.create('/');
    const teaser = (harness.routeNativeElement as HTMLElement).querySelector(
      '#blog'
    );
    expect(teaser?.textContent).toContain(BLOG_POSTS[0].title.en);
    expect(teaser?.querySelector('a')?.getAttribute('href')).toBe(
      `/blog/${BLOG_POSTS[0].slug}`
    );
  });

  it('introduces the owner as a software engineer on the home page, per language', async () => {
    TestBed.inject(SeoService).init();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/');
    const heading = () =>
      (harness.routeNativeElement as HTMLElement).querySelector('h1');

    for (const { id } of LANGUAGES) {
      const home = HOME_TEXTS[id];
      TestBed.inject(I18nService).setLanguage(id);
      await harness.fixture.whenStable();
      expectPageTags(document, home.title, home.description);
      expect(heading()?.textContent?.trim()).toBe(home.heading);
      expect(heading()?.querySelector('em')?.textContent).toBe(home.accent);
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
    expect(metaContent(head, 'meta[name="description"]')).toContain(
      'Privacy policy'
    );

    await harness.navigateByUrl('/blog/bacteria-wars-turn-relay');
    expect(
      head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
    ).toBe('https://wolsok.de/blog/bacteria-wars-turn-relay');
    expect(document.title).toContain('Through the wall');
    expect(metaContent(head, 'meta[property="og:type"]')).toBe('article');

    await harness.navigateByUrl('/career');
    expect(metaContent(head, 'meta[property="og:type"]')).toBe('website');
    expect(document.title).toContain('Career');
    TestBed.inject(I18nService).setLanguage('de');
    TestBed.tick();
    expect(document.title).toContain('Werdegang');
    expect(metaContent(head, 'meta[name="description"]')).toContain(
      'Freiberuflicher'
    );
  });

  /** Puts the AdSense script tag of the real index.html into the head. */
  function addIndexAdScript(): void {
    const scripts = readIndexHtml().querySelectorAll(AD_SCRIPT_SELECTOR);
    expect(scripts).toHaveLength(1);
    document.head.appendChild(document.importNode(scripts[0], true));
  }

  it('keeps the AdSense script of index.html on an indexable page', async () => {
    addIndexAdScript();
    TestBed.inject(SeoService).init();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/privacy');

    expect(document.head.querySelectorAll(AD_SCRIPT_SELECTOR)).toHaveLength(1);
    document.head.querySelector(AD_SCRIPT_SELECTOR)?.remove();
  });

  it('shows the not-found page under an unknown path, noindex, without canonical and AdSense script', async () => {
    addIndexAdScript();
    TestBed.inject(SeoService).init();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/nope/deeper');
    const head = document.head;

    expect(TestBed.inject(Router).url).toBe('/nope/deeper');
    const page = harness.routeNativeElement as HTMLElement;
    expect(page.textContent).toContain('Page not found');
    expect(page.querySelector('a[href="/"]')).not.toBeNull();
    expect(metaContent(head, 'meta[name="robots"]')).toBe('noindex');
    expect(head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(head.querySelector('meta[property="og:url"]')).toBeNull();
    expect(head.querySelector(AD_SCRIPT_SELECTOR)).toBeNull();

    await harness.navigateByUrl('/career');
    expect(head.querySelector('meta[name="robots"]')).toBeNull();
    expect(metaContent(head, 'meta[property="og:url"]')).toBe(
      'https://wolsok.de/career'
    );
    expect(
      head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
    ).toBe('https://wolsok.de/career');
  });

  it('switches the language and the theme from the header', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('header .career')?.textContent).toContain(
      'Career'
    );

    expect(root.querySelector('header .blog')?.getAttribute('href')).toBe(
      '/blog'
    );

    root
      .querySelector<HTMLButtonElement>('.switch [lang="de"] button')
      ?.click();
    await fixture.whenStable();
    expect(root.querySelector('header .career')?.textContent).toContain(
      'Werdegang'
    );
    expect(document.documentElement.lang).toBe('de');

    root.querySelector<HTMLButtonElement>('.theme')?.click();
    await fixture.whenStable();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    document.documentElement.removeAttribute('data-theme');
  });
});

/** The home page's texts as the user approved them (#3281), per language. */
const HOME_TEXTS: Localized<{
  title: string;
  description: string;
  heading: string;
  accent: string;
}> = {
  en: {
    title: 'Wolfram Sokollek – Freelance Full-Stack Software Engineer',
    description:
      'Freelance full-stack software engineer in Hamburg since 2008: Angular web apps from idea to production, with live apps, games and open source to explore.',
    heading: 'Software engineering for the web, from idea to production.',
    accent: 'from idea to production.',
  },
  de: {
    title: 'Wolfram Sokollek – Freiberuflicher Fullstack Software Engineer',
    description:
      'Freiberuflicher Fullstack Software Engineer in Hamburg seit 2008: Angular-Web-Apps von der Idee bis in Produktion, mit Live-Apps, Spielen und Open Source.',
    heading: 'Software Engineering fürs Web, von der Idee bis in Produktion.',
    accent: 'von der Idee bis in Produktion.',
  },
};

/** The meta tags SeoService writes from a page's title and description. */
const PAGE_TAGS = [
  'meta[name="description"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
];

function metaContent(root: ParentNode, selector: string): string | null {
  return root.querySelector(selector)?.getAttribute('content') ?? null;
}

/** Expects the document's title and page tags to carry these texts. */
function expectPageTags(
  doc: Document,
  title: string,
  description: string
): void {
  expect(doc.title).toBe(title);
  expect(metaContent(doc.head, 'meta[property="og:title"]')).toBe(title);
  expect(metaContent(doc.head, 'meta[name="description"]')).toBe(description);
  expect(metaContent(doc.head, 'meta[property="og:description"]')).toBe(
    description
  );
}

/** The app's real index.html, parsed. */
function readIndexHtml(): Document {
  return new DOMParser().parseFromString(
    readFileSync(join(__dirname, '../index.html'), 'utf8'),
    'text/html'
  );
}

describe('index.html', () => {
  it("leaves each page's title and tags to SeoService", () => {
    const head = readIndexHtml().head;
    for (const selector of PAGE_TAGS) {
      expect(head.querySelector(selector)).toBeNull();
    }
    expect(head.querySelector('meta[property="og:url"]')).toBeNull();
    expect(head.querySelector('link[rel="canonical"]')).toBeNull();
  });
});

describe('HOME_PAGE', () => {
  it('names the role of the career profile in its title', () => {
    for (const { id } of LANGUAGES) {
      expect(HOME_PAGE.title[id].toLowerCase()).toContain(
        CAREER_PROFILE.title[id].toLowerCase()
      );
    }
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

  it('names the same pages as the Lighthouse run', () => {
    const { url } = JSON.parse(
      readFileSync(join(__dirname, '../../lighthouse.json'), 'utf8')
    ) as { url: string[] };
    const routed = appRoutes
      .filter((route) => route.path !== '**')
      .map((route) => `/${route.path}`);
    expect(url.sort()).toEqual(routed.sort());
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
