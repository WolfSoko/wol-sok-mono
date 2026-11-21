import { Route } from '@angular/router';
import { PageData } from '../page-data';
import { BlogPost } from './blog-post';
import { BLOG_POSTS } from './posts';

/** What an article's route carries: its page data and the post itself. */
export interface BlogPostRouteData extends PageData {
  post: BlogPost;
}

const BLOG_INDEX: Route = {
  path: 'blog',
  loadComponent: () =>
    import('./blog-index.component').then((m) => m.BlogIndexComponent),
  data: {
    title: {
      en: 'Blog – Wolfram Sokollek',
      de: 'Blog – Wolfram Sokollek',
    },
    description: {
      en: 'Articles by Wolfram Sokollek on how his games and apps work under the hood: WebRTC, NAT traversal, GPU simulations, Angular and the cloud.',
      de: 'Artikel von Wolfram Sokollek darüber, wie seine Spiele und Apps unter der Haube funktionieren: WebRTC, NAT-Traversal, GPU-Simulationen, Angular und die Cloud.',
    },
  } satisfies PageData,
};

function postRoute(post: BlogPost): Route {
  return {
    path: `blog/${post.slug}`,
    loadComponent: post.loadComponent,
    data: {
      title: {
        en: `${post.title.en} – wolsok.de`,
        de: `${post.title.de} – wolsok.de`,
      },
      description: post.summary,
      type: 'article',
      post,
    } satisfies BlogPostRouteData,
  };
}

/** The blog's index and one page per post. */
export const blogRoutes: Route[] = [BLOG_INDEX, ...BLOG_POSTS.map(postRoute)];
