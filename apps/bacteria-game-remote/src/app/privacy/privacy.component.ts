import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';

/**
 * Where the policy lives, for its canonical link. The game's help screen
 * links here too (PRIVACY_POLICY_URL in the game lib). Not imported from
 * there: the lib's entry point would pull the whole game into this page.
 */
const CANONICAL_URL = 'https://bacteria-game.wolsok.de/privacy';
/** The loading screen in index.html, which the game takes down otherwise. */
const SPLASH_ID = 'bacteria-game-splash';

const TITLE = 'Datenschutz - Bacteria War';
const DESCRIPTION =
  'Datenschutzerklärung von Bacteria War, im Web und als Android-App. ' +
  'Privacy policy of Bacteria War, on the web and as an Android app.';

/**
 * The privacy policy of the game, its web app and its Android app, in
 * German (binding) and English. Only on the game's own site: the shell
 * loads the game's routes, not this one.
 */
@Component({
  selector: 'wolsok-privacy',
  imports: [MatButtonModule, RouterLink],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent {
  private readonly document = inject(DOCUMENT);
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment);

  public constructor() {
    this.document.getElementById(SPLASH_ID)?.remove();
    this.setPageTags();
    // The body scrolls, not the window, so the router's anchor scrolling
    // would not move: a link such as /privacy#en-delete is scrolled here.
    afterRenderEffect(() => {
      const id = this.fragment();
      if (id) {
        this.scrollTo(id);
      }
    });
  }

  /** Scrolls to a section - on every click, also when the URL keeps its fragment. */
  protected scrollTo(id: string): void {
    this.document.getElementById(id)?.scrollIntoView();
  }

  /** Title, description and canonical URL, put back as they were on leaving. */
  private setPageTags(): void {
    const title = inject(Title);
    const meta = inject(Meta);
    const previousTitle = title.getTitle();
    const previousDescription = meta.getTag('name="description"')?.content;
    title.setTitle(TITLE);
    meta.updateTag({ name: 'description', content: DESCRIPTION });
    const canonical = this.document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = CANONICAL_URL;
    this.document.head.append(canonical);

    inject(DestroyRef).onDestroy(() => {
      title.setTitle(previousTitle);
      if (previousDescription !== undefined) {
        meta.updateTag({ name: 'description', content: previousDescription });
      }
      canonical.remove();
    });
  }
}
