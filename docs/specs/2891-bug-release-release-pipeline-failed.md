# Spec #2891: release pipeline failed (tag already exists)

[Release workflow run 42508288701](https://github.com/WolfSoko/wol-sok-mono/actions/runs/42508288701)
failed in `release / version` with:

```
Unexpected error when creating tag nx-aws-cdk-v2@4.1.6:
fatal: tag 'nx-aws-cdk-v2@4.1.6' already exists
```

## What happened

Two PRs merged within minutes on 2026-11-08: `ee6da60` ([#2890](https://github.com/WolfSoko/wol-sok-mono/pull/2890))
and then `a3b478c5` ([#2887](https://github.com/WolfSoko/wol-sok-mono/pull/2887)).
Each push to `main` starts its own CI/CD run, and each calls `release.yml`.
The `version` job is serialized (`concurrency: release`), but not ordered: the
newer run's CI finished first, so its version job ran first, bumped the
published packages (`nx-aws-cdk-v2@4.1.6`, …) and released `v74.141.0` on top of
`a3b478c5`, which contains `ee6da60`. That release deployed (`v74.141.0-*-deployed`).

The older run's version job ran next, on its validated commit `ee6da60`. That
checkout still holds the old package versions, so `nx release version` bumped
`nx-aws-cdk-v2` from 4.1.5 to 4.1.6 again and failed on the tag the newer run
had already pushed. The stand-down that exists for exactly this case ("main
moved on since this run started") only runs after a rejected push, which this
run never reached. Nothing was lost; the run is red and opened this issue.
The same failure is learning L250 of the cockpit and recurs whenever CI of two
close merges finishes out of order.

## Goal

The version job stands down **before** versioning when the branch no longer
points at the commit its run validated, with the same notice and summary as
today's push fallback. Out-of-order runs then end green without a release, as
the newer commit's run releases (or already released) both changes.

## Non-goals

- No change to how versions are computed (`nx release version`,
  `commit-and-tag-version`) or to the later `release`/`deploy` jobs.
- No change to the CI/CD workflow's concurrency or to the order of runs.
- No retry on other tag errors: a tag that exists while the branch still points
  at the validated commit is a real error and keeps failing the job.

## Decisions

- **Check the branch tip first, keep the push fallback.** The version jobs run
  one at a time, so no other release can land between the check and the push;
  a new merge still can, and the existing fallback after a rejected push keeps
  handling that. Both use one script, so the notice and the comparison are
  written once.
- **The check lives in a script, `tools/release/branch-moved-on.sh`**, called
  by both steps: it fetches the branch, compares its tip to the validated
  commit, and, when they differ, writes the notice and the step summary and
  exits 0; otherwise exits 1. The workflow steps read its exit code.
- **Standing down is safe:** the branch only moves on through a new commit,
  whose own CI/CD run counts the changes since the last release tag and so
  releases this commit's changes too, exactly as with today's push fallback.
  `workflow_dispatch` runs on the tip, so the check passes for them.
- **The stood-down changes wait for the newer run.** A run that stands down
  leaves its changes to the newer commit's run; if that run's CI fails, they
  wait for the next green run on `main`. Today's push fallback has the same
  property; the early check also stands down runs that used to reach the
  push, so it happens more often. `docs/DEPLOYMENT.md` says so.

## Acceptance

1. When the branch tip differs from the validated commit at the start of the
   version job, the job ends successfully without running `nx release
   version`, writing the "moved on" notice and summary, and `version` output
   stays empty (so `release` and `deploy` are skipped).
2. When the tip equals the validated commit, the job versions, tags and pushes
   as before.
3. A push rejected because the branch moved on after the check still stands
   down as before; any other rejected push still fails.
4. `release.yml` is valid (actionlint, or GitHub accepting the workflow on the
   PR) and the script passes `bash -n` (and `shellcheck` where available).
5. `docs/DEPLOYMENT.md` describes the early stand-down and that stood-down
   changes wait for the next green run when the newer commit's CI fails.

## Open questions

None.
