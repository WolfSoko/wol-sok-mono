import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { I18nService } from '../../../i18n/i18n.service';
import { BlogArticleComponent } from '../../blog-article.component';
import { BlogPostRouteData } from '../../blog.routes';
import { TurnRelayDeComponent } from './turn-relay-de.component';
import { TurnRelayEnComponent } from './turn-relay-en.component';

/** The article on the TURN relay, in the language the site speaks. */
@Component({
  selector: 'wolsok-turn-relay-post',
  imports: [BlogArticleComponent, TurnRelayEnComponent, TurnRelayDeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <wolsok-blog-article
      [post]="post"
      playUrl="https://bacteria-wars.wolsok.de"
    >
      @switch (i18n.language()) {
        @case ('de') {
          <wolsok-turn-relay-de />
        }
        @default {
          <wolsok-turn-relay-en />
        }
      }
    </wolsok-blog-article>
  `,
})
export class TurnRelayPostComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly post = (
    inject(ActivatedRoute).snapshot.data as BlogPostRouteData
  ).post;
}
