# Analytics

What RollaPolla and Bacteria Wars measure with Google Analytics 4 (through
Firebase Analytics), how the consent works, and what the owner sets up in
GA4 so the reports show it. The code is `@wolsok/shared-analytics`
(`libs/shared/analytics`); each app keeps its event catalog as a type.

## Rules

- **Opt-in only.** Nothing loads before the visitor says yes (Google Consent
  Mode, basic): no gtag.js, no cookie, no request. Ads, ad personalisation and
  Google signals are always off (`ANALYTICS_CONFIG`). Withdrawing stops the
  collection and deletes the `_ga` cookies.
- **Events from before the answer** wait in memory (at most
  `MAX_PENDING_COMMANDS`, 50) and go out once the visitor consents; declining
  drops them. Nothing is stored on the device before the answer.
- **No personal data in names or values**: no account, poll, room, replay or
  friend ids, no names, no text a visitor typed. Page views carry the route's
  pattern (`/poll/:pollId`, `/watch/:publicId`), never the URL, its query or
  its hash (`#friend=…`, ghost links); a change of only the query (the poll
  search) is no page view. `page_title` is the pattern too, since the
  document's title can hold a poll's question.
- **Only where the app runs on its own**: RollaPolla in the browser in
  production (`main.ts`, not the server, not `nx serve` or e2e), the game on
  its own site and in the Android app (the remote's `app.config.ts`, only
  with a `measurementId`, so not in development or e2e). Inside the shell
  (`angular-examples`) the game measures nothing: `@wolsok/shared-analytics`
  is skipped in `tools/federation/workspace-federation.js`, so the shell
  never shares an `Analytics` with the remote.
- **A change to what is sent goes into the privacy policy in the same PR**:
  the game's `apps/bacteria-game-remote/src/app/privacy` (section 11,
  German binding, English) and RollaPolla's `/privacy`
  (`apps/rollapolla-analog/src/app/pages/privacy.page.html`, section 5).

## How to add an event

1. Add it to the app's catalog: `RollaPollaEvents`
   (`apps/rollapolla-analog/src/app/core/analytics/rollapolla-analytics.ts`) or
   `GameEvents` (`libs/features/lazy/bacteria-game/src/lib/analytics/game-analytics.ts`).
   Use a GA4 recommended event where one fits; otherwise snake_case, at most
   40 characters, parameters of at most 100 characters (cut by
   `toGaParams`).
2. Call `analytics.track(name, params)` at the one place the action
   completes, in a service where there is one, with
   `injectRollaPollaAnalytics()` / `injectGameAnalytics()`. Without analytics
   (server, development, shell, specs) the call does nothing.
3. Test it with `RecordingAnalytics` (`@wolsok/shared-analytics/testing`):
   `provideRecordingAnalytics(analytics)`, then `analytics.tracked(name)`.
4. Update the tables here and, for the game, the privacy policy.
5. Register new parameters as custom definitions in GA4 (below).

## RollaPolla (`rollapolla-v1`, `G-6ZM8TB6QCY`)

Consent: the banner at the bottom (`rap-consent-banner`) asks for each purpose
of `SiteConsent` on its own: usage statistics (this page) and ads (Google
AdSense, `core/consent/ad-consent.ts`: the ad script loads only after a yes;
withdrawn, ad requests pause and Google's ad cookies on rollapolla.com go).
"Privacy settings" in the footer and on `/privacy` asks again. Choices in
`localStorage` `rap-analytics-consent` and `rap-ads-consent`.

| Event               | Parameters                                                                     | Where                                  |
| ------------------- | ------------------------------------------------------------------------------ | -------------------------------------- |
| `page_view`         | `page_path` (route pattern)                                                    | every route the router lands on        |
| `poll_created`      | `options`, `listed`                                                            | `CreatePollComponent.save`             |
| `poll_edited`       | `options`, `listed`, once the backend took it                                  | `CreatePollComponent.save`             |
| `poll_deleted`      | - (once the backend took it)                                                   | `PollOwnerActionsComponent.deletePoll` |
| `vote`              | `options`, `featured`, `just_created`                                          | `PollVoteComponent.vote`               |
| `vote_failed`       | `late` (refused after it was shown)                                            | `PollVoteComponent`                    |
| `share`             | `method` (`native`, `copy`, target id), `content_type` (`poll`, `site`)        | `ShareComponent`                       |
| `select_content`    | `content_type: poll`, `list` (`hot`, `browse`, `featured`, `mine`), `position` | the poll lists                         |
| `poll_list_sorted`  | `sort`                                                                         | `/polls`                               |
| `poll_not_found`    | - (the first answer per poll, so no deletion)                                  | `/poll/:pollId`                        |
| `login` / `sign_up` | `method: google` (`sign_up`: an anonymous visitor linked to Google)            | `AccountAdapter.signInWithGoogle`      |
| `chat_message_sent` | `chat` (`lobby`, `poll`)                                                       | the two chats                          |

User property: `account` (`none`, `anonymous`, `google`).

## Bacteria Wars (`bacteria-wars`, web stream `G-5HSMB2CHGY`)

Consent: the main menu asks (`StatsBannerComponent`, before the guest and the
install banner), only once the ad network's consent window, where the game
has ads, is done with (`GameAds.consentSettled`), so the two never stack. Settings → Privacy →
Usage statistics and the button in the privacy policy change it. Choice in
`localStorage` `bacteria-wars-stats-consent`.

The game keeps one URL, so its screens are `screen_view` events
(`firebase_screen`: `menu`, `new-game`, `colony`, `profile`, `friends`,
`settings`, `help`, `evolution`, `leaderboards`, `my-matches`, `replay`,
`pause`, `over`, `match`), from the stage's panel (`trackScreenViews`). The
routes (`/`, `/privacy`, `/impressum`, `/watch/:publicId`, `/admin`) are
page views.

Every match event carries `level_name` (the level id), `kind`
(`vs_computer`, `training`, `daily`, `endless`, `two_players`, `online`,
`ghost`), `difficulty`, `ranked`, `simulation` (`cpu`, `gpu`, `int`) and
`ruleset` (`cpu`, `gpu-int`, `float`).

| Event                                                                                                                | Parameters                                                                                                                                                        | Where                                                             |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `level_start`                                                                                                        | the match's                                                                                                                                                       | `MatchAnalytics.started` (`GameStateService.start`)               |
| `level_end`                                                                                                          | + `success`, `outcome` (`win`, `loss`, `draw`, `decided`), `reason`, `duration_sec`, `medal`, `new_best`, `achievements`, `levels_unlocked`, `xp`, `mission_done` | `MatchAnalytics.ended` (`endMatch`)                               |
| `match_abandoned`                                                                                                    | + `duration_sec` (how long it ran)                                                                                                                                | reset or restart before the end                                   |
| `unlock_achievement`                                                                                                 | `achievement_id`                                                                                                                                                  | per achievement a match earned                                    |
| `level_up`                                                                                                           | `level` (rank number), `character` (rank id)                                                                                                                      | a match's XP reached a new rank                                   |
| `spend_virtual_currency`                                                                                             | `virtual_currency_name: dna`, `value`, `item_name`, `item_category` (`gene`, `weapon`, `skin`)                                                                    | `EvolutionService`                                                |
| `setting_changed`                                                                                                    | `setting`, `value` (`REPORTED_SETTINGS`, and `simulation`; a value set again counts as none)                                                                      | `GameSettingsService.changed`, `SimulationOverrideService.choose` |
| `login` / `login_failed` / `logout`                                                                                  | `method: google` / `reason` (`cancelled`, `failed`)                                                                                                               | `SignIn`                                                          |
| `profile_saved`                                                                                                      | `first`                                                                                                                                                           | `SocialService.saveProfile`                                       |
| `friend_request_sent`, `friend_request_answered` (`accepted`), `friend_removed`, `invite_accepted`, `challenge_sent` |                                                                                                                                                                   | `SocialService`                                                   |
| `share`                                                                                                              | `method` (`native`, `copy`), `content_type` (`friend_invite`, `ghost_run`)                                                                                        | friends screen, result screen                                     |
| `matchmaking_started`, `matchmaking_found` (`wait_sec`), `matchmaking_cancelled` (`found`, `wait_sec`)               |                                                                                                                                                                   | `MatchmakerService`                                               |
| `online_connected`                                                                                                   | `role`, `matchmade`                                                                                                                                               | `OnlineMatchService.greet`                                        |
| `online_ended`                                                                                                       | `reason`, `notice` (the notice's text key)                                                                                                                        | `OnlineMatchService.endWith`                                      |
| `replay_saved`                                                                                                       | `online`, `ranked`                                                                                                                                                | upload accepted                                                   |
| `replay_watched`                                                                                                     | `source: my_matches`                                                                                                                                              | My matches                                                        |
| `replay_deleted`, `replay_kept_out`                                                                                  | `cloud`                                                                                                                                                           | My matches                                                        |
| `tip_dialog_opened`, `tip` (`product_id`, `outcome`), `tip_link_opened`                                              |                                                                                                                                                                   | support                                                           |
| `install_prompt` (`outcome`), `install_offer_dismissed`, `app_installed`                                             |                                                                                                                                                                   | `InstallOffer`                                                    |
| `gpu_self_test`                                                                                                      | `passed`, `ran_through`                                                                                                                                           | `GpuSelfTestService`                                              |
| `simulation_fallback`                                                                                                | -                                                                                                                                                                 | `PlayerService` (GPU failed to start)                             |

User properties (`reportUserProperties`, from the stage): `language`,
`platform` (`browser`, `web_app`, `android_app`), `account` (`guest`,
`google`, `device`), `rank`, `free_play`.

The Android app's own Firebase Analytics (installs, launches) reports to the
same project as its Android stream; the game inside the app reports to the web
stream with `platform: android_app`.

## Set up in GA4 (owner, once per property)

Nothing here can be done from the code. Without it the events arrive, but the
reports show none of their parameters, and page views may count twice.

1. **Data streams → web stream → Enhanced measurement**: keep "Page views"
   and "Scrolls"; switch off "Page changes based on browser history events"
   (the apps send their own `page_view` with the route pattern, the history
   one would count twice), "Site search", "Outbound clicks" (a share link's
   URL holds the poll's question), "Form interactions", "Video engagement"
   and "File downloads".
2. **Data collection**: Google signals off, granular location and device data
   as needed; **Data retention**: 2 months, as the game's privacy policy
   says (section 11). Raising it to 14 months changes that text too.
3. **Custom definitions → Custom dimensions** (event scope): `kind`,
   `difficulty`, `ranked`, `simulation`, `ruleset`, `outcome`, `reason`,
   `medal`, `new_best`, `mission_done`, `item_category`, `setting`, `value`
   (text), `role`, `matchmade`, `notice`, `source`, `product_id`, `first`,
   `accepted`, `found`, `online`, `cloud`, `passed`, `level_name`, and for
   RollaPolla `listed`, `featured`, `just_created`, `late`, `list`, `sort`,
   `chat`. `method`, `content_type`, `achievement_id`, `character`,
   `virtual_currency_name` and `item_name` are built in.
   **Custom metrics**: `duration_sec` (seconds), `xp`, `achievements`,
   `levels_unlocked`, `wait_sec`, `options`, `position`.
   **User scope**: `language`, `platform`, `account`, `rank`, `free_play`.
4. **Key events**: RollaPolla `poll_created`, `vote`, `share`, `sign_up`; the
   game `level_end`, `login`, `tip`, `app_installed`.
5. **Funnels worth building** (Explore): game first visit → consent →
   `level_start` → `level_end` (training, then campaign); new-game screen →
   `level_start` by `kind`; RollaPolla `/` → `poll_created` → `share` →
   `vote` on the shared poll.

To watch events arrive, open the site with the
[Google Analytics Debugger](https://chromewebstore.google.com/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna)
on and look at Admin → DebugView.

## Open points

- RollaPolla has no legal notice (Impressum, § 5 DDG) yet; its privacy
  policy names the controller from `SITE_OWNER` (`@wolsok/shared-legal`),
  whose postal address is still to be filled in.
- The portfolio (`wolsok.de`) and `angular-examples` measure nothing; either
  can use `provideFirebaseAnalytics` the same way (and a privacy text).
- The public replay pages (`/replays`, rendered by the `publicSite`
  function) measure nothing; they are plain HTML without the app.
