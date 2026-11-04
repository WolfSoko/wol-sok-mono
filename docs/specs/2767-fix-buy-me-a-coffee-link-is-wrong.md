# Spec: Buy Me a Coffee link is wrong (#2767)

## Goal

The game's "Buy me a coffee" button and its privacy policy point to
`https://buymeacoffee.com/wolf`, a page that is not the owner's. They must
point to `https://buymeacoffee.com/wolfsoko`.

## Non-goals

- No change to the Play tips in the Android app, the ads or the button's look.
- No new support channel.

## Decisions

- **The handle changes in one place**, `SUPPORT_DEFAULTS.buyMeACoffeeHandle`
  in `apps/bacteria-game-remote/src/environments/game-support.ts`, to
  `wolfsoko`. Every environment (dev, emulator, prod) takes it from there.
- **The privacy policy renders the link from that handle** instead of
  spelling the URL twice by hand (section 8, German and English). The second
  copy is why the wrong handle had to be fixed in three places; with one
  source the policy can no longer drift from the button.
- **The URL is built by one pure function**, `buyMeACoffeeUrl(handle)`, moved
  from `game-support.service.ts` into the lib's `support/game-support.ts` and
  exported from `@wolsok/feat-lazy-bac-game`, so the service and the privacy
  page build it alike.
- **A spec pins the real URL**: the privacy page's spec checks that both
  language sections link to `https://buymeacoffee.com/wolfsoko`, so a wrong
  handle fails CI.
- The test fixture's handle (`src/testing/game-support-options.ts`) becomes
  `wolfsoko` too, so the specs show the real page rather than a stranger's.

## Acceptance

1. On the web the support button's link is `https://buymeacoffee.com/wolfsoko`.
2. The privacy policy's section 8 links to and names
   `buymeacoffee.com/wolfsoko`, in German and English.
3. No source file outside `node_modules` still contains `buymeacoffee.com/wolf"`
   or the handle `'wolf'`.
4. `test`, `lint` and `lint-templates` of the affected projects pass.

## Open questions

None.
