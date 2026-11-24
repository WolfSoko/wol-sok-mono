import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { I18nService } from '../i18n/i18n.service';

/**
 * The page for every path the site has no page for. Prerendered once as
 * `404/index.html`, which CloudFront serves with status 404 for every miss
 * (`notFoundPage` in portfolio-cdk); the router shows it for unknown paths
 * too, so it stays after hydration under the URL the visitor typed.
 *
 * It carries no AdSense script (`removeAdScript`), so its link home is a
 * plain `href`, not a router link: a full page load brings the script back
 * for the rest of the visit.
 */
@Component({
  selector: 'wolsok-not-found',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  protected readonly t = inject(I18nService).texts;
}
