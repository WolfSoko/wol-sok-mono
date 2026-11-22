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
