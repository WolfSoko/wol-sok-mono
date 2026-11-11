# Spec #2900: move admin-access.service.spec.ts onto FakeFirebaseAuth

Issue: [#2900](https://github.com/WolfSoko/wol-sok-mono/issues/2900), found
while doing [#2797](https://github.com/WolfSoko/wol-sok-mono/issues/2797)
([PR #2896](https://github.com/WolfSoko/wol-sok-mono/pull/2896)).

## Goal

`AdminAccessService`'s spec
(`libs/features/lazy/bacteria-wars-admin/src/lib/access/admin-access.service.spec.ts`)
runs on the shared `FakeFirebaseAuth` (`libs/features/lazy/bacteria-game/src/testing/fake-firebase-auth.ts`),
reached through `FakeFirebase` from `@wolsok/feat-lazy-bac-game/testing`, and
drops its own `FakeUser` and `authSdk` fake. The shared fake learns the two
things the service reads that it lacks: `authStateReady()` on the Auth
instance and `authTime` on the token.

## Non-goals

- No change to `AdminAccessService` or any production code.
- No new cases in the admin spec; the same six behaviours stay covered.
- No other spec moves (the remaining hand-made Auth fakes, e.g. in
  `game-cloud.spec.ts`, are out of scope).

## Decisions

- **`authTime` is required on `FakeToken`**, as on Firebase's
  `IdTokenResult`, an RFC 1123 UTC string (`Date#toUTCString`). A token
  without it would let `Date.parse` yield `NaN` unnoticed.
  `PLAIN_GOOGLE_TOKEN` carries `FAKE_AUTH_TIME` (exported), an hour before
  `FAKE_SERVER_TIME`, so a default token reads as signed in a while ago.
  The game account's spec builds its owner token on `PLAIN_GOOGLE_TOKEN`.
- **`authStateReady()` resolves at once**: the fake knows its user
  synchronously (`become`), so Auth's state is always settled. A method on
  `FakeFirebaseAuth`, since the connection hands the fake itself out as
  `auth`.
- **A token helper, not hand-written literals**: `fakeToken(claims,
  { signInProvider?, authTime? })` builds a `FakeToken` with the plain
  Google defaults, so specs name only what differs.
- **The admin spec takes `FakeFirebase` and `provideFakeGameCloud`** from
  `@wolsok/feat-lazy-bac-game/testing`, as `admin-commands.service.spec.ts`
  does; the Google popup sign-in is answered per spec through
  `fake.auth.signInWithPopup.mockImplementation(...)` with
  `fake.auth.become(googleUser(...))`. `googleUser`, `guestUser` and
  `fakeToken` join the testing entry's exports.

## Acceptance

1. `FakeFirebaseAuth.authStateReady()` resolves; its spec says so.
2. `FakeToken` has `authTime`; `PLAIN_GOOGLE_TOKEN.authTime` equals
   `new Date(FAKE_AUTH_TIME).toUTCString()`; `fakeToken` fills the defaults
   and takes overrides (spec).
3. `admin-access.service.spec.ts` declares no `FakeUser` and no `authSdk`
   object of its own and imports the fake from
   `@wolsok/feat-lazy-bac-game/testing`.
4. Its six cases (grant, three refusals, guest/nobody, no project, sign-in
   then sign-out, failed sign-in) still pass, including the fresh-token
   check (`getIdTokenResult` called with `true`) and `signedInLately`.
5. `feat-lazy-bacteria-game` and `feat-lazy-bacteria-wars-admin` test,
   lint and `typecheck-specs` (where present) are green.

## Open questions

None.
