# Spec: Lint guard: keep /testing entry points out of production code ([#2898](https://github.com/WolfSoko/wol-sok-mono/issues/2898))

## Goal

A production source file must not import test-only code. The `/testing`
entry points (`@wolsok/feat-lazy-bac-game/testing`,
`@wolsok/feat-shared-bacteria-engine/testing`,
`@wolsok/feat-korbjaeger-auswahl/testing`,
`@wolsok/feat-shared-basketball-data/testing`,
`@wolsok/shared-analytics/testing`) and the `testing/` folders under a
project's `src/` hold fakes that call `jest.fn` or `vi.fn` at module load;
pulled into a chunk they break it at runtime. Today no lint rule stops such
an import: the boundary rule counts `<lib>/testing` as `<lib>`, and no
`no-restricted-imports` override names a testing path. Lint must fail on it.

## Non-goals

- No guard for the frameworks' own testing entries (`@angular/core/testing`,
  `@angular/platform-browser/testing`): only the workspace's test code.
- No change to which files the libs export or build, nor to the federation
  skip list.
- No lint of `tools/`, `e2e/` or other test infrastructure outside `src/`:
  `tools/korbjaeger/*.ts` and `apps/korbjaeger/e2e/fake-dbb/server.cts`
  import `@wolsok/feat-shared-basketball-data/testing` on purpose.

## Decisions

- **A rule of the workspace's JS plugin, `wolsok/no-testing-import`**, in
  `tools/oxlint/workspace-rules.mjs`, not a `no-restricted-imports`
  override: oxlint takes a rule's options from the last override that
  matches a file, so a workspace-wide `no-restricted-imports` override would
  replace (or be replaced by) the engine's, the basketball lib's and the
  watch entry's own lists. A rule of its own stays independent of them.
- **What it reports**: an `import`, `export … from`, `import()` or
  `require()` whose source is a workspace testing entry (`@wolsok/<name>/testing`
  or below it) or a relative path with a `testing` segment
  (`./testing`, `../testing/fake-dbb`, `../../testing`), type-only imports
  included (a type import is no runtime harm, but production code has no
  reason to name a fake's type either, and one rule is simpler than two).
- **Where it runs**: production sources only, enabled by an override in
  `.oxlintrc.json` for `apps/*/src/**` and `libs/**/src/**`.
- **Which files under `src/` count as test code** is decided by the rule
  from the file name, so the spec can check it: `*.spec.*`, `*.test.*`,
  `*.emulator.*` (emulator specs), `*.cy.*` (Cypress component tests),
  `*.mock.*`, `test-setup.*`, a project's `testing.ts` entry and every file
  below a `testing/` folder. The list is a named constant with a comment.
- **Spec**: `tools/oxlint/workspace-rules.spec.mjs` runs the rule through
  oxlint as it does the others, with cases for every reported form and every
  exempt file kind, and a case for the framework testing entries staying
  allowed.

## Acceptance

1. A production file under `apps/*/src` or `libs/**/src` importing
   `@wolsok/feat-lazy-bac-game/testing` (or any other workspace `/testing`
   entry) or a relative `testing` path fails `nx lint` with
   `wolsok(no-testing-import)`; the spec shows it for `import`,
   `export … from`, `import()` and `require()`.
2. Spec files, emulator specs, Cypress tests, mocks, `test-setup.ts`, the
   `testing.ts` entries and files below `testing/` stay allowed (spec cases).
3. `@angular/core/testing` and other non-workspace testing entries stay
   allowed (spec case).
4. No production file imports a testing entry today: `nx run-many -t lint`
   passes with the rule on.
5. `npx nx test oxlint-workspace-rules` passes; `CLAUDE.md`'s lint section
   names the rule.

## Open questions

None.
