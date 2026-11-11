# Plan #2900: move admin-access.service.spec.ts onto FakeFirebaseAuth

Spec: [docs/specs/2900-…](../specs/2900-arch-move-admin-access-service-spec-ts-onto-fakefirebaseauth.md).
Test first in each task; `npx nx format:write` and
`npx nx affected -t lint,lint-templates` before each commit.

1. **Shared fake: `authStateReady`, `authTime`, `fakeToken`** —
   `libs/features/lazy/bacteria-game/src/testing/fake-firebase-auth.ts`
   (+ `fake-firebase-auth.spec.ts`), `firebase-game-account.spec.ts`
   (owner token from `fakeToken`), `src/testing.ts` exports `googleUser`,
   `guestUser`, `fakeToken`. Tests: acceptance 1–2. Commit
   `test(feat-lazy-bacteria-game): give the fake Auth authStateReady and the token's authTime`.
2. **Admin spec on the shared fake** —
   `libs/features/lazy/bacteria-wars-admin/src/lib/access/admin-access.service.spec.ts`.
   Tests: acceptance 3–4. Commit
   `test(feat-lazy-bacteria-wars-admin): run the access spec on the shared fake Auth`.
3. **Docs** — spec and plan in the same PR; no CLAUDE.md change needed.
