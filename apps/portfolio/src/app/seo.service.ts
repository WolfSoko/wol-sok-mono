import { DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { PageData } from './app.routes';
import { I18nService } from './i18n/i18n.service';

export const SITE_URL = 'https://wolsok.de';

/**
 * Keeps the title, description, canonical URL and Open Graph tags in step
 * with the route and the language, so every prerendered page carries its
 * own (in English, the language the pages are prerendered in) and a switch
 * of the language renames the tab.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  private readonly navigated = signal(0);

  public constructor() {
    effect(() => {
      if (this.navigated() > 0) {
        this.update();
      }
    });
  }

  public init(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => this.navigated.update((count) => count + 1));
  }

  private update(): void {
    let route = this.route.snapshot;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const { title, description } = route.data as Partial<PageData>;
    const path = this.router.url.split(/[?#]/)[0];
    const url = SITE_URL + path;
    if (description) {
      const text = this.i18n.pick(description);
      this.meta.updateTag({ name: 'description', content: text });
      this.meta.updateTag({ property: 'og:description', content: text });
    }
    this.meta.updateTag({ property: 'og:url', content: url });
    if (title) {
      const text = this.i18n.pick(title);
      this.title.setTitle(text);
      this.meta.updateTag({ property: 'og:title', content: text });
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
