import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map, switchMap } from 'rxjs/operators';

import type { MainNavRouteData } from '../app-routing';

export const SITE_URL = 'https://angularexamples.wolsok.de';
export const SITE_NAME = 'Angular Examples by wolsok';
export const DEFAULT_DESCRIPTION =
  'Interactive Angular showcase by Wolfram Sokollek: WebGL shaders, ' +
  'TensorFlow.js, gpu.js, WebAssembly, Fourier analysis, Mandelbrot deep ' +
  'zoom and Module Federation demos.';

/**
 * Keeps title, description, canonical URL and the Open Graph / Twitter tags
 * in sync with the active route.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        switchMap(() => this.deepestPrimaryRoute().data),
        map((data) => data as Partial<MainNavRouteData>)
      )
      .subscribe((data) => this.update(data));
  }

  public update(data: Partial<MainNavRouteData>): void {
    const pageTitle =
      data.linkText && data.linkText !== 'Home'
        ? `${data.linkText} | ${SITE_NAME}`
        : SITE_NAME;
    const description = data.description ?? DEFAULT_DESCRIPTION;
    const url = SITE_URL + this.router.url.split(/[?#]/)[0];

    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.setCanonical(url);
  }

  private deepestPrimaryRoute(): ActivatedRoute {
    let route = this.activatedRoute;
    while (route.firstChild != null && route.firstChild.outlet === 'primary') {
      route = route.firstChild;
    }
    return route;
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = url;
  }
}
