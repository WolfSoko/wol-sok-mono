# bacteria-game-remote: Firebase SDK sub-packages in the remote's chunks

Issue: [#3063](https://github.com/WolfSoko/wol-sok-mono/issues/3063)

## Goal

Find out whether the `chunk-*` files of `bacteria-game-remote`'s federation build that hold `@firebase/util`, `@firebase/component`, `@firebase/logger`, `@firebase/app` (47 kB) and `@firebase/installations` (11 kB) are a second copy of the shared `firebase/*` bundles that shell and remote load twice, and if so, whether the `@firebase/*` sub-packages need sharing or skipping in `tools/federation/workspace-federation.js`.

## Findings (production builds of `bacteria-game-remote` and `angular-examples` on `main` at 7a3f464, Firebase 12.19.0)

- **The chunks are the shared bundles' own split chunks.** Native Federation builds all shared packages in one esbuild run with code splitting. The code the `firebase/*` entries have in common lands in internal chunks that the import map names `@nf-internal/chunk-<hash>`: `firebase_app.*.js` is a 1.5 kB re-export of `@nf-internal/chunk-CPMACI3F` (the 47 kB), and `firebase_analytics` and `firebase_remote_config` both import `@nf-internal/chunk-I5WS4QGF` (`@firebase/installations`, 11 kB). Only the `firebase_*` bundles and each other import them; no module of the remote's own code does (`Routes-*`, `main-*`, its lazy chunks).
- **The shell builds the same chunks** (`chunk-GQKBBLT3`, 47 123 bytes, and `chunk-RYMAH6FG`, 11 110 bytes) and shares the same seven `firebase/*` entries (`app`, `app-check`, `auth`, `database`, `firestore`, `analytics`, `remote-config`), all at 12.19.0, singleton, strict.
- **Inside the shell nothing loads twice.** Served locally with the shell's prod manifest pointed at the remote's build, `/bacteriaGame` renders the game's menu and fetched every Firebase file from the shell (`firebase_app`, `_auth`, `_firestore`, `_app_check`, `_database`, `_remote_config`, `chunk-GQKBBLT3`, `chunk-RYMAH6FG`); from the remote only `remoteEntry.json` and `Routes-*.js`. The game's Remote Config fetch ran, so its code used the shell's copy.
- **On its own site the remote loads each file once**: its seven bundles' files plus `chunk-CPMACI3F` and `chunk-I5WS4QGF`, one request each.
- **Why it counts towards `allScript`**: Angular's budget sums every script in the output, shared bundles and their chunks included, so the 58 kB are part of the remote's own (standalone) Firebase payload, measured like `firebase_auth` or `firebase_firestore`. It is no duplicate.

## Decisions

- **No change to sharing or skipping.** Sharing `@firebase/*` would add entries nothing imports by name (esbuild resolves them inside the shared build), and skipping them would bundle a second `@firebase/app` into the remote's code, whose component registry the shared `firebase/*` entries would not see.
- **Write the finding down where the next measurement looks**: a bullet in `CLAUDE.md`'s Native Federation section and a comment in `workspace-federation.js`, so a `chunk-*` holding a shared package's code is not taken for a duplicate again.

## Non-goals

- No budget change, no change to how analytics or Remote Config load.
- No automated guard that shell and remote share the same `firebase/*` entries (a remote sharing an entry the shell lacks would bring its own `@firebase/app` chunk). Raised to the manager as a possible follow-up.

## Acceptance

1. The spec records the measurement above (which chunk holds what, who imports it, what loads in the shell and standalone).
2. `CLAUDE.md` (Native Federation) and `tools/federation/workspace-federation.js` say that `chunk-*` files of shared packages are `@nf-internal` chunks loaded only with those packages, and that `@firebase/*` needs no entry.
3. `nx format:check` and the lint targets of `tools` pass; no build output changes.

## Open questions

None.
