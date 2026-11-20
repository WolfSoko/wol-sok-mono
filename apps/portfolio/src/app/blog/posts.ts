import { BlogPost } from './blog-post';

/** Every article of the blog, newest first. */
export const BLOG_POSTS: readonly BlogPost[] = [
  {
    slug: 'bacteria-wars-turn-relay',
    published: '2026-11-20',
    title: {
      en: 'Through the wall: how Bacteria Wars relays online matches through TURN',
      de: 'Durch die Wand: wie Bacteria Wars Online-Matches über TURN weiterleitet',
    },
    summary: {
      en: 'Two phones on mobile data could not play each other. What NATs do to peer-to-peer WebRTC, what STUN and TURN are, and how the game wires Cloudflare’s TURN relay in without calling a single function.',
      de: 'Zwei Handys im Mobilfunknetz konnten nicht gegeneinander spielen. Was NATs mit Peer-to-Peer-WebRTC machen, was STUN und TURN sind und wie das Spiel Cloudflares TURN-Relay anbindet, ohne eine einzige Funktion aufzurufen.',
    },
    loadComponent: () =>
      import('./posts/bacteria-wars-turn-relay/turn-relay-post.component').then(
        (m) => m.TurnRelayPostComponent
      ),
  },
];

/** The post of a slug, if there is one. */
export function findBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug);
}
