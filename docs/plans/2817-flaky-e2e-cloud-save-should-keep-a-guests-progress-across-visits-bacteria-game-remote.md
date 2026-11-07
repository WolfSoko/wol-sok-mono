# Plan: flaky e2e cloud-save "should keep a guest's progress across visits"

Spec: [`docs/specs/2817-flaky-e2e-cloud-save-should-keep-a-guests-progress-across-visits-bacteria-game-remote.md`](../specs/2817-flaky-e2e-cloud-save-should-keep-a-guests-progress-across-visits-bacteria-game-remote.md). All paths are under `apps/bacteria-game-remote/`.

1. **Show the race.** Locally (`serve-e2e` and `firebase-emulators` running), run the guest test once with the page's CPU throttled through CDP (`Emulation.setCPUThrottlingRate`, rate 6) in a scratch copy of the spec, and note whether the attempt was stored at the moment of the old reload. Nothing committed.
2. **The fix, in `e2e/cloud-save.spec.ts`.** Add `visitAgain(page)`: a new page in `page.context()`, its `BacteriaGamePo`, `goto()`. In "should keep a guest's progress across visits" check `expectAttemptsLeft(…, 2)` in that tab before `page.reload()`; in "should take the progress this device kept before into the cloud" check the medallion (`openProfile(…).medallions` contains `1 of`) there before the reload. A comment at each reload says it must come after the save landed. Run the spec on Chromium, then with the throttling from step 1, then `--repeat-each=10`. Commit `test(bacteria-game-remote): wait for the cloud save before reloading in the cloud-save e2e`.
3. **Spec and plan** go into the same PR, committed first as `docs(bacteria-game-remote): spec and plan for the flaky cloud-save e2e`.
4. Before each commit `npx nx format:write` and `npx nx affected -t lint,lint-templates`.
