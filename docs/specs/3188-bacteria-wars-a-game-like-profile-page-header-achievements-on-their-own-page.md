# Spec: a game-like profile header, achievements on their own page ([#3188](https://github.com/WolfSoko/wol-sok-mono/issues/3188))

## Goal

The owner: "The Profile Page looks lame at the top. Improve the design. It's a
game... Keep the datenschutz settings, move the achievements to an extra page."

Today the profile screen (`menu/profile.component.*` in
`feat-lazy-bacteria-game`) opens with the screen header and right below it a
plain form: the online profile's editor (name, motto, picture, the share-status
toggle and the "In public" group). Rank, figures, the achievement list and the
medallion cabinet follow. Nothing at the top says "this is your player".

After the change:

1. The profile opens with a **player card**: the player's picture in a petri
   dish glowing in their colony colour, their rank emblem pinned to it, their
   name in the display face, their motto, the rank with its XP bar, and a
   button to their achievements that shows how many they earned.
2. The editor with every privacy setting stays on the profile, below the card.
3. The achievements move to a **screen of their own**, opened from the card,
   with the way back leading to the profile.

## Decisions

- **The card is a component of its own**, `menu/profile-card.component.*`
  (`feat-lazy-bac-game-profile-card`): the profile's stylesheet stays under the
  component style budget, and the card can be tested on its own. Inputs: `xp`,
  `earned` (achievements earned), `total` (achievements in the game); output:
  `achievements`. It reads the player's saved profile from `SocialService`
  itself, as the editor does.
- **What the card shows**:
  - The picture: the avatar of `SocialService.profile()` at 96 px inside a
    ring in `--bw-player`, the rank emblem (`RankBadgeComponent`, 40 px)
    pinned to its lower right. Without the cloud (`profile()` is null) the
    rank emblem alone takes the picture's place, larger.
  - The name: the profile's name; without the cloud a new text
    "Your colony" / "Deine Kolonie". The motto in quotes when there is one.
  - The rank: `RankStandingComponent` moves here from the summary, so the
    rank is shown once. The summary keeps the rank ladder, the figures and
    the medallion tally.
  - The achievements button: a tile button like the main menu's tiles (a
    plain `<button>`), with a trophy icon, "Achievements", "{earned} of
    {total}" and a thin bar filled to the share earned.
  - Its look: the screens' panel with a radial glow of `--bw-player` behind
    the dish and faint cells drawn with CSS gradients - no images, no
    animation beyond what the rank bar has.
- **The saved profile, not the draft**: the card shows the stored name, motto
  and picture (`SocialService.profile()`), so it changes once the player
  saves - like every other place that shows the player to others.
- **The editor is untouched**: `ProfileEditorComponent` keeps its markup,
  its Lab Pass welcome and its field focus. Its section stays first below
  the card, so the Lab Pass's "Make profile" and "Write motto" still land on a
  visible, focused field (#3175).
- **The achievements screen** is `menu/achievements.component.*`
  (`feat-lazy-bac-game-achievements`), a new `MenuScreen` `'achievements'`.
  It takes the list, its day formatting and its texts from the profile
  (moved, not copied): a header with the way back labelled "Profile", the
  count "{earned} of {total}" with a progress bar, then one card per
  achievement in the catalogue's order, earned ones gold with their day,
  the others locked (a lock in place of the initial) with their condition.
  The Lab Member reward is one of them, as before.
- **The way back from the achievements leads to the profile**, by its button
  and by Escape. Which screen a screen goes back to is one pure function,
  `parentScreen(screen)` in `flow/stage-screens.ts` (`'achievements'` →
  `'profile'`, every other screen → `'menu'`), used by the Escape handler of
  `BacteriaGameComponent` instead of its fixed `'menu'`.
- **Analytics**: the new screen is a `screen_view` like every other
  (`firebase_screen: achievements`), from `trackScreenViews`; nothing new is
  sent. `docs/analytics.md` lists it. The privacy policy names no screens, so
  it needs no change.
- **Texts** in English and German: `profile.card.*` (local name, achievements
  button) and `profile.achievements.*` (screen title, back label, progress
  bar label, locked). The keys of the achievement list move with it.

## Non-goals

- No change to what the editor saves, to the privacy settings, to the account
  line in the screen header, or to how achievements are earned.
- No new achievements, no XP or rarity per achievement.
- No route or URL: the game keeps one URL, so no sitemap or SEO change.

## Acceptance

1. The profile shows the player card above the editor: the saved name and
   motto, the avatar with the rank emblem, the rank with its XP bar
   (component specs of the card and the profile).
2. Without the cloud the card shows "Your colony" and the rank emblem, and
   no editor (card and profile specs).
3. The editor with the share-status toggle and the "In public" group
   (public name, leaderboard opt-out, gallery opt-out) is still on the
   profile (profile spec).
4. The profile no longer lists the achievements; its card's button shows
   "{earned} of {total}" and opens the achievements screen (profile and game
   component specs).
5. The achievements screen lists every achievement, earned ones with their
   day, the others with their condition, the Lab Member reward among them,
   in English and German (achievements spec).
6. Its back button and Escape lead to the profile; Escape from every other
   screen still leads to the menu (`parentScreen` spec, game component spec).
7. The existing e2e specs that open the profile (`cloud-save.spec.ts`,
   `online-social.spec.ts`) keep their locators (the figures, the editor's
   fields, the account line) and pass.
8. In the running game (`nx serve bacteria-game-remote`) the card reads as
   part of the game on a phone (390 px) and a desktop (1280 px) width, and
   the achievements screen opens and goes back (checked by hand with
   Playwright screenshots).
9. Lint, template lint, `typecheck-specs`, the lib's tests and the
   production build of `bacteria-game-remote` (budgets) pass.

## Open questions

- None blocking. The card's exact look is a first take; the owner may want
  to tune it after seeing it.
