import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  input,
  OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';
import { SITE_URL } from '../seo.service';
import { BlogPost } from './blog-post';
import { blogPostingJsonLd } from './blog-post-json-ld';
import { publishedLabel } from './published-label';

const JSON_LD_ID = 'blog-post-json-ld';

/**
 * The frame every article shares: date, title and lead from its
 * {@link BlogPost}, its `BlogPosting` data in the head while it is open,
 * the article's own text projected in, and the links at its end.
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
      @if (post().callToAction; as action) {
        <a matButton="filled" [href]="action.url">{{
          i18n.pick(action.label)
        }}</a>
      }
    </footer>
  `,
  styleUrl: './blog-page.scss',
})
export class BlogArticleComponent implements OnInit {
  public readonly post = input.required<BlogPost>();

  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly published = computed(() =>
    publishedLabel(this.i18n, this.post())
  );

  public ngOnInit(): void {
    const script = this.document.createElement('script');
    script.id = JSON_LD_ID;
    script.setAttribute('type', 'application/ld+json');
    script.textContent = blogPostingJsonLd(this.post(), SITE_URL);
    this.document.getElementById(JSON_LD_ID)?.remove();
    this.document.head.appendChild(script);
    // another page must not carry this article's data
    this.destroyRef.onDestroy(() => script.remove());
  }
}
