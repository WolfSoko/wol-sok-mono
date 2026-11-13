# Check after each Hosting deploy that the live site serves the built index.html

Issue: [#3073](https://github.com/WolfSoko/wol-sok-mono/issues/3073)

## Goal

On 2026-11-11, `korbjaeger:deploy` of v74.167.3 succeeded in 20 s while `korb.wolsok.de` went on serving the previous release until the next one, a day later ([#3058](https://github.com/WolfSoko/wol-sok-mono/issues/3058)). Nothing noticed. After each Firebase Hosting deploy, the deploy target now fetches the live site's `index.html` and compares it with the built one, so a release whose Hosting release did not go live fails instead of leaving the site stale.

Sites: `korbjaeger` (`korb.wolsok.de`), `bacteria-game-remote` (`bacteria-wars.wolsok.de`), `pacetrainer` (`pace-trainer.com`), `rollapolla-analog` (`rollapolla.com`).

## Non-goals

- No redeploy or retry of the deploy when the check fails: the release fails and says so; a dispatch of `deploy.yml` redeploys (#3058). The retry of the Hosting deploys themselves is [#3034](https://github.com/WolfSoko/wol-sok-mono/issues/3034).
- No check of other files (chunks, assets): `index.html` names the release's chunks, so it stands for the release.
- No change to what or when a release deploys.

## Decisions

- **One script, `tools/deploy/check-live-index.ts`** (project `tools-deploy`, run as `tsx --tsconfig tools/tsconfig.tools.json tools/deploy/check-live-index.ts <firebase-config> <site-url>`), the last command of each app's `deploy` target, after the Firebase deploy. The decision is a pure function, `checkLiveIndex` (`tools/deploy/live-index.ts`), spec'd in `tools-deploy:test` with fakes for the fetch and the pause, as `runWithOneRetry` is.
- **The built file comes from the Firebase config**: `hosting.public` of the root `firebase.<x>.json` (an object or an array of one entry, as the configs hold it) plus `index.html`, so the dist path is written once. A config with no or several Hosting entries is refused.
- **Compare the bytes** of the body with the built file. Hosting's `etag` is no plain hash of the file (checked: it differs from the SHA-256 of the body, raw or gzipped), and `last-modified` says when, not what.
- **Fetch `/` of the public domain**, the URL visitors use, with a cache-busting query (`?deploy-check=<time>`) and `Cache-Control: no-cache`, since pacetrainer and rollapolla send `max-age=3600` and the CDN answers from its cache. `/` is the static `index.html` on all four sites (prerendered `/` in the two Analog apps; Hosting serves files before rewrites).
- **Wait for the release to propagate**: up to 12 attempts 10 s apart (2 minutes); a match ends it at once. A fetch error or a status other than 200 counts as a mismatch for that attempt.
- **Fail loudly**: after the last mismatch it prints `::error::` with the URL, the live `last-modified`, both lengths and the first differing line, and exits 1, which fails the deploy task and the release leg. Each mismatched attempt logs one line.
- **korbjaeger's site URL** in the command is checked against `SITE_URL` by `firebase-deploy.spec.ts`; the other apps' commands get a small spec of the four targets in `tools/deploy` (`deploy-targets.spec.ts`) that each Hosting deploy ends with the check on its config.
- `pacetrainer`, `rollapolla-analog` and `bacteria-game-remote` change `deploy`'s `command` into `commands` (`parallel: false`), keeping their Firebase call as it is.
- CLAUDE.md gets one sentence in the Firebase deploy paragraph: a new Hosting deploy ends with the check.

## Acceptance

1. `checkLiveIndex` resolves `ok` on the first matching fetch, after mismatches within the attempts, and fails after the last mismatch; fetch errors and non-200 count as mismatches; the error message names URL, `last-modified`, lengths and the first differing line (specs).
2. The built path is read from `hosting.public` for object and one-entry array configs; a config without Hosting or with several entries is refused (specs).
3. Each of the four `deploy` targets ends with the check on its own root Firebase config and its public URL; korbjaeger's URL equals `SITE_URL` (specs).
4. Run by hand against the live sites with the current release's built `index.html` it passes, and against a modified local copy it fails with the error (manual, noted in the PR).
5. The first release after the merge runs the check in the deploy legs and stays green (checked after release).

## Open questions

None.
