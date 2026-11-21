# Plan: Blog article on wolsok.de

Spec: `docs/specs/3159-blog-article-on-wolsok-de.md`. One PR, `Closes #3159`.
Every task runs `npx nx test portfolio`, `npx nx lint portfolio`,
`npx nx lint-templates portfolio` and `npx nx format:write` before its commit.

1. **Spec and plan.** `docs/specs/3159-…`, `docs/plans/3159-…`.
   Commit `docs(portfolio): spec and plan for the blog article (#3159)`.
2. **Blog model and routes, test first.**
   - Specs: `blog/posts.spec.ts` (slugs unique and URL-safe, dates valid,
     newest first, every post has both languages); extend
     `app.component.spec.ts`: `/blog` and the article set their title,
     description and canonical URL. The sitemap and Lighthouse specs
     already compare with the routes, so they go red once routes exist.
   - Files: `blog/blog-post.ts` (type), `blog/posts.ts` (list),
     `blog/blog.routes.ts` (index route plus one route per post, with
     `PageData`), `app.routes.ts` (spread them in), `public/sitemap.xml`,
     `lighthouse.json`.
   - Commit `feat(portfolio): blog routes built from one list of posts (#3159)`.
3. **Blog index and header link.**
   - Spec: `blog/blog-index.component.spec.ts` (lists every post, newest
     first, links to its slug, date in the active language);
     `app.component.spec.ts` header shows "Blog"/"Blog" and links to
     `/blog`.
   - Files: `blog/blog-index.component.{ts,html}`, `blog/blog-page.scss`,
     `i18n/texts.en.ts`, `i18n/texts.de.ts` (nav and blog texts),
     `app.component.html`.
   - Also the home page teaser of the newest post (`home.component`), with
     its spec in `app.component.spec.ts`.
   - Commit `feat(portfolio): blog index, header link and home teaser (#3159)`.
4. **Article shell and JSON-LD.**
   - Spec: `blog/blog-post-json-ld.spec.ts` (headline, `datePublished`,
     author, URL); the article component spec checks that the body follows
     the language (English text, German text after a switch).
   - Files: `blog/blog-post-json-ld.ts`, `blog/blog-article.component.ts`
     (shared frame: title, date, notice, JSON-LD, back link, content
     projection), `blog/posts/bacteria-wars-turn-relay/…component.ts`.
   - Commit `feat(portfolio): article frame with BlogPosting data (#3159)`.
5. **Pictures.** Six SVGs in
   `public/blog/bacteria-wars-turn-relay/`, each with `viewBox`, a title
   element and the light paper background; checked by eye in both themes.
   Spec: the article spec checks every `<img>` has `alt`, `width`, `height`
   and a file that exists in `public/`.
   Commit `feat(portfolio): pictures for the TURN relay article (#3159)`.
6. **Article text, English and German.** One template per language with the six sections of the spec's
   Goal, the figures and small code excerpts (the `relay/turn` document
   shape, the `RTCPeerConnection` config, the renewal), facts checked
   against ADR 0009/0020 and the #3148 specs.
   Commit `feat(portfolio): article on how Bacteria Wars relays online matches through TURN (#3159)`.
7. **Check.** `npx nx build portfolio` (budgets), read the prerendered
   `dist/apps/portfolio/blog/bacteria-wars-turn-relay/index.html` (title,
   description, canonical, text), serve and screenshot light, dark and
   phone width; `npx nx affected -t lint,lint-templates,test,typecheck-specs --base=origin/main`.
