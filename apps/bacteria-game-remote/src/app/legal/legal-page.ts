import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

/**
 * Where the site lives, for the canonical links and the sitemap. The game
 * lib knows it too (GAME_SITE_URL): not imported from there, since the
 * lib's entry point would pull the whole game into these pages.
 */
export const SITE_ORIGIN = 'https://bacteria-wars.wolsok.de';

/** The loading screen in index.html, which the game takes down otherwise. */
const SPLASH_ID = 'bacteria-game-splash';

/** What a legal page says about itself in the document head. */
export interface LegalPageTags {
  readonly title: string;
  readonly description: string;
}

/**
 * Sets a legal page up: takes the loading screen down, sets its title and
 * description and the canonical URL of its route, and puts them back as
 * they were on leaving. Called from the component's constructor.
 */
export function setUpLegalPage(tags: LegalPageTags): void {
  const document = inject(DOCUMENT);
  const title = inject(Title);
  const meta = inject(Meta);
  const path = inject(ActivatedRoute)
    .snapshot.url.map((segment) => segment.path)
    .join('/');

  document.getElementById(SPLASH_ID)?.remove();

  const previousTitle = title.getTitle();
  const previousDescription = meta.getTag('name="description"')?.content;
  title.setTitle(tags.title);
  meta.updateTag({ name: 'description', content: tags.description });
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = `${SITE_ORIGIN}/${path}`;
  document.head.append(canonical);

  inject(DestroyRef).onDestroy(() => {
    title.setTitle(previousTitle);
    if (previousDescription !== undefined) {
      meta.updateTag({ name: 'description', content: previousDescription });
    }
    canonical.remove();
  });
}
