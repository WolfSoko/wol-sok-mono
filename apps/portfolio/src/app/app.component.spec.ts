import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppComponent } from './app.component';
import { appRoutes } from './app.routes';
import { APPS, EXPERIMENTS, PACKAGES } from './projects';
import { SeoService } from './seo.service';

describe('AppComponent', () => {
  beforeEach(() => {
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

  it('sets the canonical URL and description per page', async () => {
    TestBed.inject(SeoService).init();
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/privacy');
    const head = document.head;
    expect(
      head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
    ).toBe('https://wolsok.de/privacy');
    expect(
      head.querySelector('meta[name="description"]')?.getAttribute('content')
    ).toContain('Datenschutzerklärung');
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
