import { SITE_OWNER } from '@wolsok/shared-legal';
import { blogPostingJsonLd } from './blog-post-json-ld';
import { BLOG_POSTS } from './posts';

describe('blogPostingJsonLd', () => {
  it('names headline, date, author and URL of the post', () => {
    const post = BLOG_POSTS[0];
    const data = JSON.parse(blogPostingJsonLd(post, 'https://wolsok.de')) as {
      '@type': string;
      headline: string;
      datePublished: string;
      url: string;
      author: { name: string };
    };
    expect(data).toMatchObject({
      '@type': 'BlogPosting',
      headline: post.title.en,
      datePublished: post.published,
      url: `https://wolsok.de/blog/${post.slug}`,
      author: { name: SITE_OWNER.name },
    });
  });
});
