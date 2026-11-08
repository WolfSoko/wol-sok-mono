# Spec #2846: Lint rule: no direct reads of version.json outside @wolsok/utils-version

Found on [#2841](https://github.com/WolfSoko/wol-sok-mono/issues/2841):
`apps/angular-examples-cdk/src/main.ts` read `version.json` with
`readFileSync(join(process.cwd(), 'version.json'))`. The module-boundary rule
of PR [#2752](https://github.com/WolfSoko/wol-sok-mono/pull/2752)
([#2737](https://github.com/WolfSoko/wol-sok-mono/issues/2737)) only catches
an `import` of the file, so an fs read slips past it, the file is no Nx input
of the reader, and a release may not rerun its cached targets.

## Goal

A workspace oxlint rule, `wolsok/no-version-json-read`, in
`tools/oxlint/workspace-rules.mjs` next to `wolsok/no-boundary-disable`,
fails every linted file outside `libs/utils/version` that reads the root
`version.json`:

- as a module: `import … from '…/version.json'`, `export … from`,
  `import('…/version.json')`, `require('…/version.json')`;
- through a read call: a string naming `version.json` that reaches, through
  the arguments of the same expression (`join`, `resolve`, a template
  literal), a call whose function name starts with `read` (`readFileSync`,
  `readFile`, `readJson`, `fs.promises.readFile`, …).

Its message points to `WORKSPACE_VERSION` / `releaseName` from
`@wolsok/utils-version`.

## Non-goals

- No fix of `apps/angular-examples-cdk/src/main.ts`: that is
  [#2841](https://github.com/WolfSoko/wol-sok-mono/issues/2841), open as
  PR [#2843](https://github.com/WolfSoko/wol-sok-mono/pull/2843). This PR
  lands after it (the rule would fail that project's lint until then).
- No data-flow analysis: a path built in one statement and read in another
  (`const p = join(…, 'version.json'); readFileSync(p)`) is not caught. The
  rule closes the pattern that slipped through, it is no proof.
- No lint for `tools/` scripts outside a project (see decisions).

## Decisions

- **Match reads, not every mention.** A plain string-literal ban would also
  hit `Source.jsonData('version.json', WORKSPACE_VERSION)` in the CDK stack,
  which names the asset it _writes_ to S3, and the error message
  `'version.json has no string "version"'`. So the rule reports a literal
  only as a module source or as (part of) an argument of a `read…` call.
  Comments are no literals and stay free.
- **A file name, not a substring.** A specifier or path counts when its last
  segment is exactly `version.json` (`version.json`, `./version.json`,
  `../../version.json`, `C:\x\version.json`); `@wolsok/utils-version`,
  `package-version.json` or `version.json.bak` do not.
- **The lib is exempt through `.oxlintrc.json`**, as the boundary exception
  already is: an override for `libs/utils/version/**` turns the rule off, so
  the one sanctioned reader (`version.ts`) and its spec (which reads the file
  to compare) stay visible in one place.
- **`tools/version-handling` and `tools/bacteria-game/deploy-android.ts` stay
  as they are.** Neither belongs to an Nx project, so `nx lint` never lints
  them and the rule cannot reach them. Both run in release or deploy steps
  that are not cached on the file (`latest-*-deployed-tag.ts` are `runtime`
  inputs, evaluated on every run; `deploy-android` is an uncached deploy),
  so the reason for the rule does not apply. `tsx` would also need the
  path alias set up for them first. Moving them is a follow-up, not part of
  this ticket.
- **Tested against oxlint itself**: a `node:test` spec writes small sources
  into a temp folder and runs the workspace's `oxlint` with a config that
  loads only this plugin, reading the JSON report. That checks the rule as CI
  runs it (oxlint's JS plugin API, `node.parent`), not under ESLint's
  RuleTester. It becomes the `test` target of `oxlint-workspace-rules`; the
  spec imports nothing from the workspace, so the project stays a leaf.
- **CLAUDE.md** names the rule in the "Linting & Formatting" bullet about
  `@wolsok/utils-version`.

## Acceptance

1. Reported in a linted file: `readFileSync(join(process.cwd(), 'version.json'), 'utf8')`,
   `readFileSync('version.json')`, ``readFile(`${root}/version.json`)``,
   `fs.promises.readFile('./version.json')`, `readJson('version.json')`,
   `import { version } from '../../version.json'`,
   `export { version } from '../version.json'`, `import('../version.json')`,
   `require('../../version.json')`.
2. Not reported: `Source.jsonData('version.json', v)`,
   `throw new Error('version.json has no string "version"')`,
   `import { WORKSPACE_VERSION } from '@wolsok/utils-version'`,
   `readFileSync('package-version.json')`, `readFileSync('version.json.bak')`,
   a comment naming `version.json`.
3. Not reported in `libs/utils/version/src/version.ts` and its spec
   (override in `.oxlintrc.json`).
4. `npx nx run-many -t lint` passes on the workspace once PR #2843 is in
   `main`; before it, the rule reports exactly
   `apps/angular-examples-cdk/src/main.ts` (checked by hand).
5. `npx nx test oxlint-workspace-rules` runs the spec of 1–3 and passes;
   dropping the read-call check or the module check makes it fail (checked by
   hand, not committed).
6. Format check passes; CLAUDE.md names the rule.

## Open questions

None.
