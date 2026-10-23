import { DOCUMENT } from '@angular/common';
import { afterRenderEffect, DestroyRef, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { GAME_SITE_URL, SPLASH_ID } from '@wolsok/feat-lazy-bac-game';

/** What a legal page says about itself in the document head. */
export interface LegalPageTags {
  readonly title: string;
  readonly description: string;
}

/** What a legal page can do once set up. */
export interface LegalPage {
  /** Scrolls to a section - on every click, also when the URL keeps its fragment. */
  scrollTo(id: string): void;
}

/**
 * Sets a legal page up: takes the loading screen down, sets its title and
 * description and the canonical URL of its route, puts them back as they
 * were on leaving, and scrolls to the section the URL's fragment names.
 * Called from the component's constructor.
 */
export function setUpLegalPage(tags: LegalPageTags): LegalPage {
  const document = inject(DOCUMENT);
  const title = inject(Title);
  const meta = inject(Meta);
  const route = inject(ActivatedRoute);
  const path = route.snapshot.url.map((segment) => segment.path).join('/');

  document.getElementById(SPLASH_ID)?.remove();

  const previousTitle = title.getTitle();
  const previousDescription = meta.getTag('name="description"')?.content;
  title.setTitle(tags.title);
  meta.updateTag({ name: 'description', content: tags.description });
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = `${GAME_SITE_URL}/${path}`;
  document.head.append(canonical);

  inject(DestroyRef).onDestroy(() => {
    title.setTitle(previousTitle);
    if (previousDescription !== undefined) {
      meta.updateTag({ name: 'description', content: previousDescription });
    }
    canonical.remove();
  });

  const scrollTo = (id: string): void => {
    document.getElementById(id)?.scrollIntoView();
  };
  // The body scrolls, not the window, so the router's anchor scrolling
  // would not move: a link such as /privacy#en-delete is scrolled here.
  const fragment = toSignal(route.fragment);
  afterRenderEffect(() => {
    const id = fragment();
    if (id) {
      scrollTo(id);
    }
  });

  return { scrollTo };
}
