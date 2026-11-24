import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';

/**
 * The page for every path the site has no page for. Prerendered once as
 * `404/index.html`, which CloudFront serves with status 404 for every miss
 * (`notFoundPage` in portfolio-cdk); the router shows it for unknown paths
 * too, so it stays after hydration under the URL the visitor typed.
 */
@Component({
  selector: 'wolsok-not-found',
  imports: [RouterLink, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  protected readonly t = inject(I18nService).texts;
}
