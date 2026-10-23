import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { setUpLegalPage } from '../legal/legal-page';
import { SITE_OWNER } from '../legal/site-owner';

/**
 * Where the notice lives, for its canonical link. The game's footer links
 * here (LEGAL_NOTICE_URL in the game lib). Not imported from there: the
 * lib's entry point would pull the whole game into this page.
 */
const CANONICAL_URL = 'https://bacteria-wars.wolsok.de/impressum';

const TITLE = 'Impressum - Bacteria Wars';
const DESCRIPTION =
  'Impressum von Bacteria Wars, im Web und als Android-App: Anbieter, Kontakt und Haftung. ' +
  'Legal notice of Bacteria Wars, on the web and as an Android app.';

/**
 * The legal notice (Impressum) the game's site owes under § 5 DDG, in
 * German (binding) and English. Only on the game's own site: the shell
 * loads the game's routes, not this one.
 */
@Component({
  selector: 'wolsok-impressum',
  imports: [MatButtonModule, RouterLink],
  templateUrl: './impressum.component.html',
  styleUrl: './impressum.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImpressumComponent {
  protected readonly owner = SITE_OWNER;

  public constructor() {
    setUpLegalPage({
      title: TITLE,
      description: DESCRIPTION,
      canonicalUrl: CANONICAL_URL,
    });
  }
}
