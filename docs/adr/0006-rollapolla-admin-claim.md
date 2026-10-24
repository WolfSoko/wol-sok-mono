# 6. RollaPolla admins are a custom claim, users come from Firebase Auth

- Status: accepted
- Date: 2026-10-16
- Scope: `apps/rollapolla-analog`
- Supersedes: the `admins` and `users` collections of [ADR 0005](0005-rollapolla-admin-page.md)

## Context

ADR 0005 kept admins as `admins/{uid}` documents and had every visitor
signed in with Google write their own `users/{uid}`, because the app had no
server to call the Admin SDK. That cost an `exists()` read per admin-guarded
rule, a Firestore listener per Google visitor for the header's Admin link,
a write per visitor per day, and rules to stop visitors from faking their
profile. Users from before that change never showed up.

The SSR server already runs as a Firebase Function (Nitro, `firebase`
preset), and `firebase-admin` is a workspace dependency.

## Decision

**Admin is the `admin: true` custom claim** on the Firebase Auth user.
`firestore.rules` checks `request.auth.token.admin == true` (no read). The
browser reads the claim from the sign-in token (`AdminPort.isAdmin$`).

**A small admin API on the SSR server** (`src/server/routes/v1/admin`,
logic in `src/server/admin`), served under `/api/v1/admin/`:

- `GET users?pageToken=` lists the Google users of Firebase Auth.
- `GET user-stats` counts Google users, anonymous users and admins.
- `POST role { uid, admin }` sets or removes the claim. Only Google accounts
  can be admins, and nobody revokes their own rights.

Each call sends the caller's ID token. The server verifies it and reads the
claim from the caller's user record, not from the token. A revoked admin is
therefore refused by the API at once.

**The first admin** is granted with `scripts/grant-admin.mjs`, moved to
`tools/firebase/grant-admin.mjs` by ADR 0011 (Application
Default Credentials of a project owner, or the Auth emulator).

The `admins` and `users` collections and `record-visits.ts` are gone. The
rules deny both collections.

## Consequences

- A claim reaches the user's token on its next refresh, within the hour.
  `/admin` forces a refresh on opening and offers "Check again", so a new
  admin gets in at once. A revoked admin keeps their Firestore powers
  (deleting, switching features) until their token expires, at most an
  hour; the admin API refuses them at once.
- Counting users walks all of Firebase Auth (1000 per call). That is fine
  for thousands of users, too slow for millions.
- The admin API runs with the function's service account, which needs the
  Firebase Authentication Admin role (the default compute account has it).
- In development the server talks to the Auth emulator unless it runs in
  Cloud Functions (`K_SERVICE` set).
- Leftover `admins`/`users` documents from ADR 0005 are unreadable and can
  be deleted in the console.
