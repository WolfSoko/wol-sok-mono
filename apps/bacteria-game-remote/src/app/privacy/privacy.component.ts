import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { setUpLegalPage } from '../legal/legal-page';
import { SITE_OWNER } from '../legal/site-owner';

/**
 * Where the policy lives, for its canonical link. The game's help screen
 * links here too (PRIVACY_POLICY_URL in the game lib). Not imported from
 * there: the lib's entry point would pull the whole game into this page.
 */
const CANONICAL_URL = 'https://bacteria-wars.wolsok.de/privacy';

const TITLE = 'Datenschutz - Bacteria Wars';
const DESCRIPTION =
  'Datenschutzerklärung von Bacteria Wars, im Web und als Android-App. ' +
  'Privacy policy of Bacteria Wars, on the web and as an Android app.';

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

  /** The controller, named in both languages. */
  protected readonly owner = SITE_OWNER;

  public constructor() {
    setUpLegalPage({
      title: TITLE,
      description: DESCRIPTION,
      canonicalUrl: CANONICAL_URL,
    });
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
}
