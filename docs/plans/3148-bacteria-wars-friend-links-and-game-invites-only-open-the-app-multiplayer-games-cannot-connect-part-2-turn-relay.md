# Plan: Cloudflare TURN relay for online matches (part 2 of #3148)

Spec: `docs/specs/3148-bacteria-wars-friend-links-and-game-invites-only-open-the-app-multiplayer-games-cannot-connect-part-2-turn-relay.md`.
Branch `3148-turn-relay`, one PR to `main`, "Part of #3148". Every task is
test first. Each runs the touched projects' `test`, `lint`, `lint-templates`
and `typecheck-specs`, then `npx nx format:write`, before its commit.

## 0. Owner input (before task 6)

Manual step for the owner: create a Cloudflare API token with "Calls Write"
and "Notifications Write" on the account that should own the key. Then run
`npx firebase functions:secrets:set CLOUDFLARE_API_TOKEN --project bacteria-wars`,
which prompts for the value. Tasks 1 to 5 go on meanwhile.

## 1. The record in the engine

- Files: `libs/features/bacteria-engine/src/lib/state/cloud/records/relay.ts`
  (`RelayCredentials`, `parseRelayCredentials`, `RELAY_DOC = 'relay/turn'`),
  `relay.spec.ts`, and an export in the engine's `/cloud` entry.
- Tests: acceptance 1.
- Commit: `feat(feat-shared-bacteria-engine): describe the relay credentials record (#3148)`

## 2. `refreshRelay` in the functions

- Files: `apps/bacteria-wars-functions/src/relay/refresh-relay.ts`
  (`refreshRelay(db, key, fetch, now)`: `fetch` and the key are parameters,
  so the spec fakes them), `refresh-relay.spec.ts`, `refresh-relay.emulator.ts`.
  Also `src/config.ts` (`RELAY_ON`, `RELAY_TTL_S`, `CLOUDFLARE_TURN_KEY_NAME`
  with docs), `src/main.ts` (`defineSecret('CLOUDFLARE_TURN_KEY')`,
  `onSchedule('every 30 minutes')` wrapped in `withSentry`, exported only
  with `RELAY_ON`), and `src/erasure/player-data.ts` (`relay/{doc}`, `keep`).
- Tests: acceptance 2, 3 and 5. A `main` spec checks the export behind the
  flag, if the app already has one for `HOURLY_ON`; otherwise it reads as
  `hourly` does.
- Commit: `feat(bacteria-wars-functions): refresh shared TURN credentials hourly (#3148)`

## 3. Rules

- Files: `apps/bacteria-game-remote/firestore.rules` (`match /relay/{doc}`),
  `apps/bacteria-game-remote/rules-test/firestore-rules.emulator.ts`.
- Tests: acceptance 4 (`npx nx run bacteria-game-remote:test-emulator`).
- Commit: `feat(bacteria-game-remote): let players read the relay credentials (#3148)`

## 4. The game takes the relay

- Files in `libs/features/lazy/bacteria-game/src/lib/`:
  - `storage/game-relay.ts`: the `GameRelay` port, `relay(): Promise<readonly RTCIceServer[]>`.
  - `storage/firestore-game-relay.ts`: `getDoc` of `relay/turn` with a 2 s
    timeout. On a missing, expired or unreadable document, or a failed or
    slow read, it returns `[]`.
  - `storage/game-cloud.ts`: `relay()` beside `rooms()`.
  - `net/peer-transport.ts`, `net/peer-link.ts`: `offer(relay)` and
    `answer(offer, relay)`, `iceServers: [...STUN, ...relay]`, and the docs
    on `ICE_SERVERS` rewritten.
  - `net/online-match.service.ts`: it reads the relay in `host` and `join`
    before calling the transport.
  - `testing/` `pairedTransport()`: it records the relay it got.
  - Specs: `firestore-game-relay.spec.ts`, `online-match.service.spec.ts`,
    `peer-link.spec.ts`.
- Tests: acceptance 6. The e2e stays as it is: no document on the emulator
  means STUN only.
- Commit: `feat(feat-lazy-bacteria-game): connect through the TURN relay when its credentials are there (#3148)`

## 5. Provisioning tool

- Files: `tools/relay/project.json` (`tools-relay`, tag `tools`, targets
  `test` (Jest), `turn-key` and `check`), `jest.config.ts`,
  `tsconfig.spec.json`, `turn-key.ts` (CLI), `plan-turn-key.ts` and `plan-usage-alert.ts`
  (pure),
  `cloudflare-api.ts` and `firebase-secrets.ts` (ports), `relay-check.ts`
  (Playwright Chromium, `iceTransportPolicy: 'relay'`), and their specs.
- Also: `tools/tsconfig.tools.json` and `tools/tsconfig.json` includes, if
  the new folder is not covered yet (`tools/ci/script-tsconfig.test.mjs`
  checks it), and the `nx.json` `typecheck-specs` plugin, which picks the
  new `tsconfig.spec.json` up by itself.
- Tests: acceptance 7, plus `npx nx test tools`.
- Commit: `feat(tools-relay): create the Cloudflare TURN key from the repo (#3148)`

## 6. Provision (needs step 0)

- Run `npx nx run tools-relay:turn-key` twice: the second run must report
  `keep` for the key and the alert. Then run `npx nx run tools-relay:check`,
  which also checks a relayed channel past its credentials' expiry.
- If the alert's product is missing, ask the manager (spec). If the
  expiry check fails, add the `PeerLink` refresh to task 4 (its commit
  and spec) before the PR.
- Paste both outputs, with no secrets in them, into the PR (acceptance 8).
- No commit.

## 7. ADR, privacy policy, docs

- Files: `docs/adr/0020-bacteria-wars-turn-relay.md`, and the status line
  of `docs/adr/0009-bacteria-wars-online-lockstep.md`.
- `apps/bacteria-game-remote/src/app/privacy/privacy.component.html`
  (`de-online`, `en-online`, "Stand") and its spec.
- `CLAUDE.md`, "Cloud Functions": `refreshRelay`, `RELAY_ON`, the two
  secrets, `tools-relay:turn-key`.
- Tests: acceptance 9 and 10.
- Commit: `docs(bacteria-game-remote): name Cloudflare's TURN relay in the privacy policy and ADR 0020 (#3148)`

## 8. PR, review, test, merge

- Open the PR. Run a fresh-subagent code review against this spec, fix what
  it finds, and post the review as a PR comment.
- List every acceptance point with its result in the PR body.
- Before the `merge` request: the owner checks the privacy paragraph. The
  `merge` request says so.
- After the deploy, check that `relay/turn` appears within an hour, by
  name and `expireAt` only, never its values. Ask the owner for the
  real-device check (acceptance 12).
