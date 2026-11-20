import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  inject,
  input,
  OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';
import { SITE_URL } from '../seo.service';
import { BlogPost, publishedOn } from './blog-post';
import { blogPostingJsonLd } from './blog-post-json-ld';

const JSON_LD_ID = 'blog-post-json-ld';

/**
 * The frame every article shares: date, title and lead from its
 * {@link BlogPost}, its `BlogPosting` data in the head, the article's own
 * text projected in, and the links back.
 */
@Component({
  selector: 'wolsok-blog-article',
  imports: [RouterLink, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="article-head">
      <p class="eyebrow">
        <a routerLink="/blog">{{ t().blog.eyebrow }}</a>
        ·
        <time [attr.datetime]="post().published">{{ published() }}</time>
      </p>
      <h1>{{ i18n.pick(post().title) }}</h1>
      <p class="lead">{{ i18n.pick(post().summary) }}</p>
    </header>
    <ng-content />
    <footer class="article-foot">
      <a matButton="outlined" routerLink="/blog">← {{ t().blog.back }}</a>
      @if (playUrl(); as url) {
        <a matButton="filled" [href]="url">{{ t().blog.playGame }}</a>
      }
    </footer>
  `,
  styleUrl: './blog-page.scss',
})
export class BlogArticleComponent implements OnInit {
  public readonly post = input.required<BlogPost>();
  /** The game the article is about, linked at its end. */
  public readonly playUrl = input<string>();

  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;
  private readonly document = inject(DOCUMENT);

  protected readonly published = computed(() =>
    this.i18n.fill(this.t().blog.published, {
      date: publishedOn(this.post(), this.i18n.locale()),
    })
  );

  public ngOnInit(): void {
    let script = this.document.getElementById(JSON_LD_ID);
    if (!script) {
      script = this.document.createElement('script');
      script.id = JSON_LD_ID;
      script.setAttribute('type', 'application/ld+json');
      this.document.head.appendChild(script);
    }
    script.textContent = blogPostingJsonLd(this.post(), SITE_URL);
  }
}
