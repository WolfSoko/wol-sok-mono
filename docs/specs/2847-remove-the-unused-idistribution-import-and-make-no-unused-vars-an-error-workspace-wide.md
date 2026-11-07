# Spec #2847: Remove the unused IDistribution import and make no-unused-vars an error workspace-wide

Found during [#2814](https://github.com/WolfSoko/wol-sok-mono/issues/2814),
which made `no-unused-vars` an error for the game lib only.

## Goal

An unused variable or import fails `nx lint` in every project, not only in
`feat-lazy-bacteria-game`.

Today:

- `.oxlintrc.json` sets `"no-unused-vars": "warn"`; a warning never fails CI.
- The only warning left in the workspace is the unused `IDistribution`
  import in `libs/public/spa-cdk-stack/src/lib/spa/spa.construct.ts:11`
  (only `Distribution` is used).
- An override in `.oxlintrc.json` (`libs/features/lazy/bacteria-game/**/*.ts`)
  raises the rule to `error` for the game lib, added by #2814.

## Non-goals

- No change to the rule's options (oxlint's defaults, such as ignoring
  `_`-prefixed names, stay).
- No other rule raised from `warn` to `error`.
- No change to what `spa-cdk-stack` builds or exports.

## Decisions

- **Remove the import** in `spa.construct.ts`. `IDistribution` is an
  interface, so the compiled JavaScript stays the same.
- **`"no-unused-vars": "error"` in the root `rules`** of `.oxlintrc.json`.
- **Drop the game lib's override**: with the global setting it only repeats
  it. The override holds that one rule only, so the whole entry goes.
- **Release type `chore`** (`chore(nx): …`): lint configuration plus a
  type-only import; nothing a consumer of `spa-cdk-stack` or a deployed app
  sees changes, so no release is needed. The import fix ships with the
  package's next release.

## Acceptance

1. `spa.construct.ts` no longer imports `IDistribution`.
2. `.oxlintrc.json` sets `no-unused-vars` to `error` at the root and has no
   override for it.
3. `npx nx run-many -t lint` passes for all projects with no
   `no-unused-vars` diagnostics.
4. An unused import added to a file outside the game lib fails `nx lint`
   for its project (checked by hand, not committed).
5. `npx nx run-many -t build,test -p spa-cdk-stack` pass.

## Open questions

None.
