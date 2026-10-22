# 7. Bacteria Wars saves progress in its own Firebase project, per account

- Status: accepted
- Date: 2026-10-22
- Scope: `libs/features/lazy/bacteria-game`, `apps/bacteria-game-remote`

## Context

The game kept everything in local storage behind the `GameStorage` port,
which was built to be swapped for Firebase. Progress was lost with the
browser's data and could not follow a player to another device.

The game runs both standalone (a PWA on CloudFront) and inside the
`angular-examples` shell, which already initialises a default Firebase app
for another project (`angularexamples-b69f4`). The game's services sit in the
root injector, and inside the shell only the remote's entry routes are
loaded, never its app config.

## Decision

**An own Firebase project** for the game, used as a named app
(`bacteria-wars`) next to the shell's default app. Its rules
(`apps/bacteria-game-remote/firestore.rules`) live in the repo.

**Guest first, Google optional.** Every visitor is signed in anonymously and
saves from the first match. Signing in with Google links the guest, which
keeps the uid. A Google account that already has progress takes over, and
the guest's progress is added to it once (`adoptProgress`). Signing out
starts a new guest.

**Only progress follows the account.** Settings (sound, controls, graphics)
go through a separate `DeviceStorage` port and stay in local storage, since
they mostly fit one device.

**One document per player and key**, `players/{uid}/storage/{key}`, holding
the value as a JSON string. Any JSON value fits, and the progress model and
its parsers stay as they are. Changes that add to counts run as
transactions, queued per key, retried once online.

**Configured on the route.** `provideGameCloud(environment.gameCloud)` in the
remote's entry route sets the root `GameCloud`, which `GameStorage` and
`GameAccount` ask for their backend. With `gameCloud: null` the game stays on
local storage, as before. Providing the game's services on that route
instead of in root would make the holder unnecessary, but moves about ten
root services and their specs; not worth it for one configuration value.

## Consequences

- The SDK (`firebase/app`, `auth`, `firestore`) loads with a dynamic import
  only when a project is set, and is shared with the shell through the
  Native Federation import map.
- The offline queue lives in memory. A match finished offline is lost if the
  page closes before the device is online again. Firestore's own offline
  writes cannot replace the transaction without giving up exactly-once
  counts.
- Signing out shows an empty profile until the player signs in again.
- Anonymous accounts that never sign in pile up in Firebase Auth. Clean them
  up later (for example with Auth's automatic clean-up of anonymous users).
- The game's domains must be listed as authorized domains of the project for
  the Google popup to work.
