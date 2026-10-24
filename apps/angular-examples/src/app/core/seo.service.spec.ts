import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Component, DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';

import { APP_ROUTES } from '../app-routing';
import { DEFAULT_DESCRIPTION, SITE_NAME, SeoService } from './seo.service';

jest.mock('@angular-architects/native-federation', () => ({
  loadRemoteModule: jest.fn(),
}));

@Component({ template: '' })
class DummyComponent {}

/**
 * Routes that redirect to a tab list the tabs instead, since the canonical URL
 * is the one after the redirect. Hidden tabs stay out.
 */
const SITEMAP_SUB_PAGES: Record<string, string[]> = {
  tensorflowExamples: ['polynomialregression', 'learnedDigits'],
  neuralNetwork: ['perceptron'],
};

describe('SeoService', () => {
  const setup = async (url: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'home',
            component: DummyComponent,
            data: { linkText: 'Home' },
          },
          {
            path: 'webGl',
            component: DummyComponent,
            data: {
              linkText: 'Mandelbrot Deep Zoom Explorer (three.js)',
              description: 'Mandelbrot description',
            },
          },
          { path: 'plain', component: DummyComponent },
        ]),
      ],
    });
    TestBed.inject(SeoService);
    await TestBed.inject(Router).navigateByUrl(url);
    return {
      title: TestBed.inject(Title),
      meta: TestBed.inject(Meta),
      document: TestBed.inject(DOCUMENT),
    };
  };

  const canonical = (document: Document) =>
    document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;

  it('uses the site name as title on the home page', async () => {
    const { title, meta } = await setup('/home');

    expect(title.getTitle()).toBe(SITE_NAME);
    expect(meta.getTag('name="description"')?.content).toBe(
      DEFAULT_DESCRIPTION
    );
  });

  it('sets title, description, og tags and canonical from route data', async () => {
    const { title, meta, document } = await setup('/webGl?zoom=3#top');

    const expectedTitle = `Mandelbrot Deep Zoom Explorer (three.js) | ${SITE_NAME}`;
    expect(title.getTitle()).toBe(expectedTitle);
    expect(meta.getTag('name="description"')?.content).toBe(
      'Mandelbrot description'
    );
    expect(meta.getTag('property="og:title"')?.content).toBe(expectedTitle);
    expect(meta.getTag('property="og:url"')?.content).toBe(
      'https://angularexamples.wolsok.de/webGl'
    );
    expect(canonical(document)).toBe('https://angularexamples.wolsok.de/webGl');
  });

  it('falls back to defaults for routes without data', async () => {
    const { title, meta } = await setup('/plain');

    expect(title.getTitle()).toBe(SITE_NAME);
    expect(meta.getTag('property="og:description"')?.content).toBe(
      DEFAULT_DESCRIPTION
    );
  });

  it('applies the active route when created after the first navigation', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          {
            path: 'poisson',
            component: DummyComponent,
            data: { linkText: 'Poisson', description: 'Poisson description' },
          },
        ]),
      ],
    });
    await TestBed.inject(Router).navigateByUrl('/poisson');

    TestBed.inject(SeoService);

    expect(TestBed.inject(Title).getTitle()).toBe(`Poisson | ${SITE_NAME}`);
    expect(TestBed.inject(Meta).getTag('name="description"')?.content).toBe(
      'Poisson description'
    );
  });

  it('gives every main route a description', () => {
    const missing = APP_ROUTES.filter((route) => !route.data.description);

    expect(missing.map((route) => route.path)).toEqual([]);
  });

  it('lists every main route in the sitemap', () => {
    const sitemap = readFileSync(join(__dirname, '../../sitemap.xml'), 'utf-8');
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => match[1]
    );

    expect(locs).toEqual(
      APP_ROUTES.flatMap((route) =>
        (SITEMAP_SUB_PAGES[route.path] ?? ['']).map((subPage) =>
          [`https://angularexamples.wolsok.de/${route.path}`, subPage]
            .filter(Boolean)
            .join('/')
        )
      )
    );
  });
});
