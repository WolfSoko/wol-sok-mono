# 17. Bacteria Wars takes its ads from a network behind a port, AdinPlay next

- Status: accepted
- Date: 2026-10-31
- Scope: `libs/features/lazy/bacteria-game` (`support/ads/`),
  `apps/bacteria-game-remote`

## Context

The game's ads were built for Google AdSense alone: `GameAds` loaded the
AdSense script, waited for Google's consent banner through `__tcfapi`, and
the ad slot was an `<ins class="adsbygoogle">` in its template. The
remote's `index.html` loaded the AdSense script on every visit, without ad
slots, so that AdSense could review the site and its consent banner showed.

AdSense keeps turning the site down for low-value content. Each further
network the owner tries would mean rewriting the service, the slot and the
privacy policy again.

The networks looked at (2026-10):

- **Ezoic**: a standalone JavaScript integration that suits an SPA, and a
  games SDK. Since 2026-02-19 it takes only new sites with 250,000 page
  views a month; smaller ones may apply to its incubator.
- **AdinPlay** (AdinPlay BV, the Netherlands): made for browser games, on
  the game's own domain. One tag (`api.adinplay.com/libs/aiptag/pub/<AIP
ID>/tag.min.js`) brings its consent tool, which reports through events on
  `document` (`aip_consent`, `aip_consentnotrequired`, …) and opens again
  with `aipAPItag.showCMPScreen()`. A display ad fills the element whose id
  is the placement's (`aipDisplayTag.display` / `destroy`). Interstitials
  only once AdinPlay switches them on, and the tag can turn them off. No
  published minimum traffic.
- **Pop-under and push networks** (Monetag, Adsterra and the like): no
  review, but ads that cover the game and harm the players' trust.

## Decision

**The game reaches an ad network only through the `AdNetwork` port**
(`support/ads/ad-network.ts`): `load` adds the network's script with its
consent banner and reports once the player has answered it, `show` puts a
display ad into an empty element and returns what takes it out again,
`openConsentSettings` opens the banner again. `GameAds` is the one place the
screens ask (the footer, the Help, the profile, the remote's privacy page);
it picks the adapter that `GameSupportOptions.ads.network` names and does
nothing without one. `AdSlotComponent` knows no network: it renders an
empty host once the consent was answered and hands it to `GameAds.show`.

**Two adapters**: `AdinPlayNetwork` and `AdSenseNetwork` (the former
`GameAds`, unchanged in what it does). A new network is an adapter, an
options type in `ad-network-options.ts` and its case in `createAdNetwork`.

**AdinPlay is the next network to apply to.** Until it takes the site, the
live site has no network (`ads: null`): `index.html` no longer loads AdSense,
so the game loads no ad script and shows no consent banner at all.

**The privacy policy follows the configured network**: section 7 and the
summary are rendered for the network `GameAds.networkName` names (none,
AdinPlay or AdSense), and `privacy.component.spec.ts` has a provider name
for every `AdNetworkName`, so a new adapter cannot ship without its text.

## Consequences

- Switching networks is a change of `environment.prod.ts`, plus the
  network's `ads.txt` lines, which it hands out with its approval: an
  `ads.txt` in `apps/bacteria-game-remote/src`, listed in the `esbuild`
  target's assets beside `robots.txt`.
- AdinPlay's text in the privacy policy names the provider, the script's
  host and the consent; the owner checks it against the wording AdinPlay
  asks for before turning it on.
- The portfolio (`wolsok.de`) and rollapolla still load AdSense on their
  own; they are not part of this decision.
