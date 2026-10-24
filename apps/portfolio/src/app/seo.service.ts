import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { PageData } from './app.routes';

export const SITE_URL = 'https://wolsok.de';

/**
 * Keeps the description, canonical URL and Open Graph tags in step with the
 * route, so every prerendered page carries its own. The title comes from the
 * route's `title`.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  public init(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.update());
  }

  private update(): void {
    let route = this.route.snapshot;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const { description } = route.data as Partial<PageData>;
    const path = this.router.url.split(/[?#]/)[0];
    const url = SITE_URL + path;
    if (description) {
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:description', content: description });
    }
    this.meta.updateTag({ property: 'og:url', content: url });
    if (route.title) {
      this.meta.updateTag({ property: 'og:title', content: route.title });
    }

    let canonical = this.document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }
    canonical.href = url;
  }
}
