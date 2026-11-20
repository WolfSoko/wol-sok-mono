import { blogRoutes } from './blog.routes';
import { BLOG_POSTS, findBlogPost } from './posts';

describe('BLOG_POSTS', () => {
  it('gives every post a unique, URL-safe slug', () => {
    const slugs = BLOG_POSTS.map((post) => post.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('dates every post on a real day, newest first', () => {
    const dates = BLOG_POSTS.map((post) => post.published);
    for (const date of dates) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${date}T00:00:00Z`).toISOString()).toContain(date);
    }
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('titles and summarises every post in both languages', () => {
    for (const post of BLOG_POSTS) {
      for (const text of [post.title, post.summary]) {
        expect(text.en.trim()).not.toBe('');
        expect(text.de.trim()).not.toBe('');
      }
    }
  });

  it('routes the index and every post', () => {
    expect(blogRoutes.map((route) => route.path)).toEqual([
      'blog',
      ...BLOG_POSTS.map((post) => `blog/${post.slug}`),
    ]);
  });

  it('finds a post by its slug', () => {
    expect(findBlogPost('bacteria-wars-turn-relay')?.published).toBe(
      '2026-11-20'
    );
    expect(findBlogPost('nothing')).toBeUndefined();
  });
});
