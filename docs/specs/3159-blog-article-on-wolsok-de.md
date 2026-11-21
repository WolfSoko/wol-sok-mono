# Spec: Blog article on wolsok.de

Issue: [#3159](https://github.com/WolfSoko/wol-sok-mono/issues/3159)

## Goal

wolsok.de gets a blog, and its first article explains how Bacteria Wars
connects two players online and why it now needs a TURN relay. The readers
are software engineers: they know HTTP and UDP, not necessarily NAT
traversal or WebRTC. The article explains

- what problem the relay solves: two devices behind NATs that cannot reach
  each other (mobile data, client-isolated Wi-Fi), as the players' reports
  in [#3148](https://github.com/WolfSoko/wol-sok-mono/issues/3148) showed;
- what a TURN server is and how it differs from STUN, and how ICE picks a
  path (host, server-reflexive, relay candidates; direct first);
- how the game is connected to it: Firestore signalling of offer and answer
  (ADR 0009), the shared short-lived credentials that `refreshRelay` writes to
  `relay/turn` every 30 minutes (ADR 0020), the Cloudflare key provisioned
  by code, the spend alert and the off switch;
- how it works over time: a relayed link dies when its credentials expire,
  so the host renews it by an ICE restart every 15 minutes over a second
  data channel;
- what it costs and what it leaks (IP addresses to Cloudflare; the match
  stays DTLS-encrypted).

It is illustrated with diagrams and funny pictures.

## Non-goals

- A CMS, Markdown pipeline, RSS feed, comments or tags. One article does
  not need them; the model leaves room for a second one.
- Changes to the game, the functions or their docs.
- Promoting the article elsewhere (social media, the game's menu).

## Decisions

- **Two routes in the portfolio**: `/blog` (the list of articles, newest
  first) and `/blog/bacteria-wars-turn-relay` (the article). Both are
  prerendered like every other route (`outputMode: static`,
  `RenderMode.Prerender` for `**`), so the article is plain HTML for search
  engines and readers without JavaScript. `portfolio-cdk` uploads every
  prerendered page a second time under its bare path, since CloudFront
  resolves no folder index, but it looked only one folder deep, so
  `/blog/bacteria-wars-turn-relay` would have served the home page. Its page
  discovery (`prerenderedPages`, with a spec) now walks nested folders.
- **One typed list of articles**, `src/app/blog/posts.ts`: per article its
  slug, publication date, `Localized` title and summary, and the lazy loader
  of its component. The routes, the blog index and the article's JSON-LD
  (`BlogPosting`) are built from it, so a second article is one entry plus
  its component. The specs keep `sitemap.xml` and `lighthouse.json` equal to
  the routes as they do today.
- **The article is an Angular component with its text in its template**
  (`src/app/blog/posts/bacteria-wars-turn-relay/`). Prose with figures,
  code and asides is easiest to read and review as HTML; a Markdown
  renderer would add a dependency and a build step for one page.
- **The article is written in English and German** (the manager's
  condition on request 1460), like the rest of the site: one component per
  language (`…-en.component.html`, `…-de.component.html`) inside the
  shared article frame, picked by `I18nService`. The page is prerendered in
  English and a German browser switches after hydration, as every page does.
  Title, description, the blog index and the alt texts are `Localized`.
  Code and identifiers are the same in both; every picture has a German
  copy (`<name>.de.svg`) with its sentences translated, so the German page
  shows no English sentence.
- **Pictures are hand-made SVG files** in
  `apps/portfolio/public/blog/bacteria-wars-turn-relay/`, loaded with
  `<img loading="lazy">` and real `alt` texts, with `width`/`height` set so
  nothing shifts (CLS). As files they add nothing to the JavaScript
  budgets; no external image or font is loaded. Each sits on its own light
  "paper" background, so it reads in the light and the dark theme. The
  pictures, in the game's style (round bacteria colonies with faces):
  1. _Title_: two bacteria colonies on two phones yelling "Can you hear
     me?" through walls labelled NAT.
  2. _The problem_ (diagram): a direct path, two NATs and why an inbound
     UDP packet from an unknown address is dropped; symmetric NAT gives a
     new public port per destination.
  3. _STUN vs TURN_ (funny): STUN as a mirror ("you look like
     203.0.113.7:51234"), TURN as a bacterium postman carrying the
     packets.
  4. _ICE candidates_ (diagram): host, server-reflexive and relay
     candidates, the pairs ICE checks and which one wins.
  5. _How the game is wired_ (sequence diagram): `refreshRelay` →
     Cloudflare → Firestore `relay/turn` → game; host offer and guest
     answer through `rooms/{code}`; data channel through the relay.
  6. _Credentials over time_ (timeline): credentials of 1 h, refreshed
     every 30 min, ICE restart every 15 min, what happens without it.
- **Navigation**: a "Blog" link in the header beside "Career", a teaser of
  the newest article on the home page (a card like the career teaser, the
  manager's addition on request 1460), and the article links back to the
  index and to the game.
- **Styling**: one shared stylesheet for the blog pages
  (`blog/blog-page.scss`, like `legal/legal-page.scss`), on the site's
  existing tokens, so no component style approaches the 4 kB warning.
- **Facts come from the repo**: ADR 0009, ADR 0020 and both specs of #3148.
  The article and its pictures quote no secret value, key id or account id
  (the manager's condition on request 1460); they name
  `CLOUDFLARE_TURN_KEY` and `CLOUDFLARE_API_TOKEN` only as names.

## Acceptance

1. `/blog` lists the article with title, date and summary, linked to
   `/blog/bacteria-wars-turn-relay`.
2. The article covers the six topics of the Goal in English and German and
   has the six pictures, each with an `alt` text in both languages.
3. Both pages set their own title, description and canonical URL in
   English and German (`SeoService`), and the article page carries a
   `BlogPosting` JSON-LD with headline, date and author.
4. `public/sitemap.xml` and `lighthouse.json` list both pages
   (`app.component.spec.ts` checks it).
5. The header shows "Blog" in both languages and links to `/blog`; the home
   page shows a teaser of the newest article linking to it.
6. The production build passes its budgets, and the prerendered HTML of
   the article contains its text, title, description and canonical URL.
7. `test`, `lint`, `lint-templates`, `typecheck-specs` of `portfolio` and
   `nx format:check` pass.
8. `portfolio-cdk` uploads `blog/bacteria-wars-turn-relay` under its bare
   path (`prerenderedPages` spec).
9. The article reads well in the light and the dark theme and at phone
   width (checked in the running app, screenshots in the PR).

## Open questions

None: request 1460 settled both (body in both languages, a home page
teaser).
