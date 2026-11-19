# Spec: infer `typecheck-specs` with a local Nx plugin (#3131)

Issue: [#3131](https://github.com/WolfSoko/wol-sok-mono/issues/3131), follow-up of
[#2822](https://github.com/WolfSoko/wol-sok-mono/issues/2822) (PR #3130, review finding 6).

## Goal

Every project with a `tsconfig.spec.json` gets its `typecheck-specs` target from
one local Nx plugin, so no `project.json` names the target any more (except a
project-specific `dependsOn`), and a project that gains specs is type-checked
without an edit of its own.

## Non-goals

- No change to what the target runs: still `tsc -p {projectRoot}/tsconfig.spec.json --noEmit`.
- No change to the `typecheck` targets `@nx/vite` infers, nor to CI's target list
  (`ci-cd.yml`, `.nx/ci-config.yaml` already name `typecheck-specs`).
- No fixes of spec type errors beyond what a newly covered project needs to pass;
  a project that would need more is left out (below) and raised as a follow-up.

## Decisions

- **Built after PR #3130 is merged, on the `main` that contains it.** #3130 adds
  `typecheck-specs` to the remaining 47 spec projects, fixes six projects' spec
  type errors and adds the guard `tools/ci/typecheck-specs.test.mjs`. Building
  before it would either conflict with all its `project.json` edits or infer the
  target on projects that do not pass yet.
- **The plugin is `tools/nx/typecheck-specs.mjs`, in the `tools` project.** It
  exports `createNodes` on `**/tsconfig.spec.json` and adds the target to the
  project whose root holds that file (a `project.json` or `package.json` beside
  it, as Nx's own plugins check). No app imports it, so a later change to it is
  no build or deploy input of any app (`release-affected.mjs` selects nothing),
  which a `targetDefaults` edit in `nx.json` would not give: `nx.json` keeps
  Nx's verdict there and releases everything.
- **The plugin owns the whole target definition** (`command`, `inputs`, `cache`),
  and the `typecheck-specs` entry leaves `targetDefaults`. One source, specced
  with the plugin; the reason above is why it does not stay in `nx.json` as the
  issue first suggested.
- **The name stays `typecheck-specs`** (option `targetName`, default
  `typecheck-specs`): `typecheck` is taken by `@nx/vite`'s inference.
- **Every project with a `tsconfig.spec.json` gets it**, whether its `test`
  target is written or inferred, which closes the guard's blind spot. A project
  whose specs do not pass (today possibly `nx-aws-cdk-v2-e2e`, which has no
  `test` target) is left out through the plugin entry's `exclude` in `nx.json`,
  with the reason beside it, and raised to the manager as a follow-up.
- **Per-project entries go.** Every `"typecheck-specs": {}` leaves its
  `project.json`; `angular-examples` keeps `{ "dependsOn": ["generate-version"] }`,
  which Nx merges onto the inferred target. This edits about 61 `project.json`
  files once more, so the next release redeploys the apps and bumps the
  published packages one last time; later additions cost nothing.
- **The guard becomes a spec of the plugin plus a check of the project files.**
  `tools/nx/typecheck-specs.test.mjs` runs `createNodes` on fixture paths (target
  shape, project root, file without a project, `targetName` option);
  `tools/ci/typecheck-specs.test.mjs` fails on a `project.json` whose
  `typecheck-specs` holds more than a `dependsOn`, and on a project with a
  `tsconfig.spec.json` that is neither inferred nor excluded (read from
  `nx show projects --with-target typecheck-specs`).

## Acceptance

1. `npx nx show projects --with-target typecheck-specs` lists every project with a
   `tsconfig.spec.json`, minus the excluded ones, and at least the 61 of #3130.
2. No `project.json` names `typecheck-specs` except `angular-examples` with only
   its `dependsOn`; `nx.json`'s `targetDefaults` has no `typecheck-specs`.
3. `npx nx show project angular-examples --json` shows `typecheck-specs` with the
   plugin's command and inputs and the `dependsOn` on `generate-version`.
4. `npx nx run-many -t typecheck-specs --skip-nx-cache` passes.
5. `npx nx test tools` passes; the guard fails when a `project.json` gets a
   `typecheck-specs` with a `command`, checked by hand.
6. A change to `tools/nx/typecheck-specs.mjs` alone selects no project in
   `tools/ci/release-affected.mjs`, checked by hand.
7. `CLAUDE.md` (Testing → "Spec typecheck") describes the plugin.
8. Lint, `lint-templates` and `nx format:check` green on the affected projects.

## Open questions

None.
