import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

/** The loading screen in index.html, which the game takes down otherwise. */
const SPLASH_ID = 'bacteria-game-splash';

/** What a legal page says about itself in the document head. */
export interface LegalPageTags {
  readonly title: string;
  readonly description: string;
  /** Where the page lives, for its canonical link. */
  readonly canonicalUrl: string;
}

/**
 * Sets a legal page up: takes the loading screen down, sets its title,
 * description and canonical URL, and puts them back as they were on
 * leaving. Called from the component's constructor.
 */
export function setUpLegalPage(tags: LegalPageTags): void {
  const document = inject(DOCUMENT);
  const title = inject(Title);
  const meta = inject(Meta);

  document.getElementById(SPLASH_ID)?.remove();

  const previousTitle = title.getTitle();
  const previousDescription = meta.getTag('name="description"')?.content;
  title.setTitle(tags.title);
  meta.updateTag({ name: 'description', content: tags.description });
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = tags.canonicalUrl;
  document.head.append(canonical);

  inject(DestroyRef).onDestroy(() => {
    title.setTitle(previousTitle);
    if (previousDescription !== undefined) {
      meta.updateTag({ name: 'description', content: previousDescription });
    }
    canonical.remove();
  });
}
