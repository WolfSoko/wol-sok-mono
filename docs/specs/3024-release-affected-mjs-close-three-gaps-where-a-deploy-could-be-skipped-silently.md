# Spec #3024: release-affected.mjs: close three gaps where a deploy could be skipped silently

Issue: [#3024](https://github.com/WolfSoko/wol-sok-mono/issues/3024). Follows
[#2888](https://github.com/WolfSoko/wol-sok-mono/issues/2888)
([PR #3019](https://github.com/WolfSoko/wol-sok-mono/pull/3019)).

## Goal

`tools/ci/release-affected.mjs` keeps Nx's affected list wherever it cannot
judge a change by file inputs, explicitly rather than by relying on how Nx
hashes tasks today:

1. a change to `nx.json`,
2. a `tsconfig.base.json` paths change touching a wildcard alias or target,
3. a candidate whose inputs could not be read (already kept, now covered by a
   unit test).

## Non-goals

- No change to `deploy.yml`, `ci-cd.yml` or any target's inputs.
- No resolution of wildcard aliases to the files they match: none exists in
  `tsconfig.base.json` today, and a glob over `paths` would duplicate how
  TypeScript resolves them. Keeping Nx's verdict is the safe side.

## Decisions

- **`nx.json` joins `keepsNxVerdict`.** Today `nx show target inputs` lists
  `nx.json` for every task, so a change keeps every candidate anyway; the
  rule now holds even if Nx stops hashing it into every task.
- **An unrefined `tsconfig.base.json` keeps Nx's verdict.** The base reaches
  `changedFiles` only as itself when its change is more than a literal paths
  change (or with `--files`, where nothing is refined). That is the case Nx
  maps through every project's tsconfig, so `keepsNxVerdict` holds for it as
  for the other root tsconfigs. Today the base is listed among every task's
  inputs, so the selection does not change; it becomes explicit.
- **A wildcard paths change counts as the base itself.**
  `tsconfigBaseChanges` returns `['tsconfig.base.json']` when any changed
  alias, or any of its old or new targets, contains `*`, and with the
  decision above that keeps Nx's verdict. One rule, no new marker value.
- **The unreadable-inputs case gets a `selectReleaseAffected` test** that
  checks both the selection and the reason
  (`Nx's verdict: its inputs could not be read`).
- `CLAUDE.md`'s "What a release deploys" names `nx.json` and the wildcard
  case beside the other files that keep Nx's verdict.

## Acceptance

- `npx nx test tools` covers: `nx.json` keeps every candidate; a wildcard
  alias change keeps every candidate; a candidate without readable inputs is
  kept with its reason; the existing cases stay green.
- Run on the workspace, `--files=nx.json --target=deploy` keeps Nx's
  affected list (every candidate it names), as does a
  `selectReleaseAffected` run on the changes a wildcard alias produces.

## Open questions

None.
