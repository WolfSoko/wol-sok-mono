# Plan #2789: functions emulator harness and one Realtime fake

1. **Fake, test first.** Write `apps/bacteria-wars-functions/src/testing/fake-realtime.spec.ts`
   for the tree, the call log, `failRemoving` and the hooks; extend
   `testing/fake-realtime.ts` until it passes. Move `src/testing/**` from
   `tsconfig.app.json` to `tsconfig.spec.json`. Check: `npx nx test bacteria-wars-functions`.
2. **Admin onto the shared fake.** Delete the private fake in
   `admin/admin.emulator.ts`; use `fakeRealtime({}, { failRemoving, hooks })`,
   read values through `realtime.get`/`tree`, seed `connections` in the
   statistics spec. Check: `test-emulator`.
3. **Harness.** Add `testing/emulator.ts` with `useEmulatorDb()` and move
   all eight `*.emulator.ts` onto it. Check: `test-emulator`, same test
   count as on `main`.
4. **Docs.** Update the `test-emulator` line in `CLAUDE.md`.
5. **Commit** `test(bacteria-wars-functions): share one emulator harness and one Realtime fake`
   after `npx nx format:write` and `npx nx affected -t lint,lint-templates`;
   open the PR to `main` with `Closes #2789`.
