# Plan: #3175 step 1 — the Lab Pass

Spec: [docs/specs/3175-...](../specs/3175-bacteria-wars-play-games-account-as-sign-in-and-a-prominent-gamified-sign-in-with-profile-onboarding.md).
All in `libs/features/lazy/bacteria-game/src/lib` (game lib) unless named.

1. **Achievement `lab-member`** — engine `state/progress/achievement-ids.ts`,
   `achievements.ts` (granted: `earned` false), `play-games-achievements.json`,
   game texts (en, de); icon via `npx nx run bacteria-wars-android:achievement-icons`.
   Tests: existing achievement and Play Games specs updated.
   Commit `feat(feat-shared-bacteria-engine): add the Lab Member achievement`.
2. **`ProgressService.grantAchievement(id)`** — stores the day once, returns
   whether it was new; toast through the existing achievement notice.
   Tests: `progress.service.spec.ts`.
3. **`labPassSteps` pure function** — `guest/lab-pass.ts` + spec.
4. **`LabPass` service** — `guest/lab-pass.service.ts`: steps from signals,
   `dismiss()` (two weeks, stored through `DeviceStorage` beside the guest
   notice), grants `lab-member` once complete and loaded. Spec.
5. **Lab Pass card** — `guest/lab-pass-card.component.ts` replacing
   `GuestBannerComponent` in `menu/main-menu.component.html`; texts en/de.
   Spec; remove the then unused guest banner and its spec.
6. **Onboarding mode** — after a guest's sign-in without a stored profile,
   open the profile screen with the editor's onboarding line and focus.
   Tests: `profile-editor.component.spec.ts`, the trigger's spec.
7. Checks: `npx nx affected -t lint,lint-templates,test,typecheck-specs --base=origin/main`,
   format, build of `bacteria-game-remote` (budgets).

Steps 3-6 commit as `feat(feat-lazy-bacteria-game): ...`, one per task.

# Plan: #3175 step 2 — Play Games as sign-in

Spec: the step 2 section of the same spec. Game lib =
`libs/features/lazy/bacteria-game/src/lib`, functions =
`apps/bacteria-wars-functions/src`. Test first in every task.

1. **Contract** — engine `state/cloud/command-documents.ts` (or a sibling
   `play-games-sign-in.ts` in `state/cloud/`): `PLAY_GAMES_SIGN_INS`
   collection name, the command's fields, `parsePlayGamesSignIn`, the
   result's `token` and errors (`linked-elsewhere`, `play-games-refused`).
   Spec beside it. Commit `feat(feat-shared-bacteria-engine): ...`.
2. **Link decision** — functions `play-games/link.ts`: pure
   `settleLink(existing, writer)` → link / keep / take over / refuse.
   Spec. Then `play-games/sign-in.ts`: exchange (injected `fetch`), player
   read, transaction on `playGamesLinks`, claim, name, custom token;
   `main.ts` export behind `PLAY_GAMES_ON`, secret
   `PLAY_GAMES_CLIENT_SECRET`, web client id in `config.ts`, `withSentry`.
   `play-games/sign-in.emulator.ts` (injected exchange, auth emulator).
   Commit `feat(bacteria-wars-functions): ...`.
3. **Guests and erasure** — `admin/guests.ts` `isIdleGuest` keeps
   `playGames: true` (spec); `erasure/player-data.ts` entries for
   `playGamesLinks` and `playGamesSignIns`, erased in `account`;
   `erasure.emulator.ts` rows. Same scope.
4. **Rules** — `apps/bacteria-game-remote/firestore.rules`:
   `playGamesSignIns` (create/get/delete by writer, exact keys, code ≤ 512),
   `playGamesLinks` closed; `rules-test` cases. Commit
   `feat(bacteria-game-remote): ...`.
5. **Account** — game lib `storage/game-account.ts` + firebase impl:
   `signInWithToken(token)` (adopts the guest on another uid), `profileOf`
   for custom-token sessions, `signIn` links an account without provider.
   Specs in `firebase-game-account.spec.ts`.
6. **Handover** — game lib `play-games/`: fragment reader (takes
   `#play-games=` off the URL), `PlayGamesHandover` (first player →
   command via a `GamePlayGames` port with a Firestore adapter in
   `storage/`, wait for the result, sign in, delete), started where the
   game cloud starts (`provide-game-cloud.ts`). Specs. Commit
   `feat(feat-lazy-bacteria-game): ...`.
7. **Android** — `PlayGamesLauncherActivity.java`, manifest swap, the web
   client id as a string resource from Gradle (`app/build.gradle.kts`),
   README section. Built and linted locally if the SDK allows, otherwise
   by the `Android app` workflow. Commit `feat(bacteria-wars-android): ...`.
8. **Privacy policy** — `apps/bacteria-game-remote/src/app/privacy`
   (English and German), spec if one checks the sections. Commit
   `feat(bacteria-game-remote): ...`.
9. **Docs** — CLAUDE.md's Cloud Functions section (the trigger, flag,
   secret, erasure), docs/analytics unaffected. Checks:
   `npx nx affected -t lint,lint-templates,test,typecheck-specs,test-emulator --base=origin/main`,
   format, `bacteria-game-remote` production build (budgets).
