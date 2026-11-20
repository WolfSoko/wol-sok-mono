import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../i18n/i18n.service';
import { blogPostPath, publishedOn } from './blog-post';
import { BLOG_POSTS } from './posts';

@Component({
  selector: 'wolsok-blog-index',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './blog-index.component.html',
  styleUrl: './blog-page.scss',
})
export class BlogIndexComponent {
  protected readonly posts = BLOG_POSTS;
  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;
  protected readonly path = blogPostPath;

  protected published(post: (typeof BLOG_POSTS)[number]): string {
    return this.i18n.fill(this.t().blog.published, {
      date: publishedOn(post, this.i18n.locale()),
    });
  }
}
