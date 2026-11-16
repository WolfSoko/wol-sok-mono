# Lint: close two coverage gaps of wolsok/no-testing-import

Issue: [#2987](https://github.com/WolfSoko/wol-sok-mono/issues/2987)

## Goal

`wolsok/no-testing-import` (`tools/oxlint/workspace-rules.mjs`) keeps test-only code out of production sources. Close two gaps found while delivering [#2898](https://github.com/WolfSoko/wol-sok-mono/issues/2898):

1. `@wolsok/shared-firebase-emulator` (and its entry `/rules`) is test-only infrastructure without a `/testing` entry, so the rule does not report it in production code.
2. The `*.emulator.*` test-file exemption also exempts `apps/bacteria-game-remote/src/environments/environment.emulator.ts`, a build environment file, not a test.

## Non-goals

- No change to which files the override in `.oxlintrc.json` enables the rule on.
- No rename of `@wolsok/shared-firebase-emulator` or its entries, and no rename of `environment.emulator.ts`.
- No general mechanism (tags, `package.json` flags) to mark libs as test-only.

## Decisions

- **Name test-only libs in the rule.** A list `TEST_ONLY_LIBS` (today `shared-firebase-emulator`) feeds `TESTING_MODULES`: `@wolsok/<lib>` and every entry below it count as test-only. Renaming the lib's entries to `/testing` would change the path aliases of three apps' emulator helpers and the CLAUDE.md wording for one lib, while the list keeps the lib's names and sits next to the patterns it extends. The rule's doc comment and CLAUDE.md name the list, so a new test-only lib goes there.
- **Narrow the emulator exemption to files outside an `environments/` folder.** An `environments/` folder holds build configurations swapped in by `fileReplacements`, never emulator specs; the narrowed pattern still exempts every `*.emulator.ts` spec in the workspace and closes the gap for any future `environment.emulator.ts` too, which a rename of the one file would not. `*.spec.*` and the other suffixes stay exempt everywhere (`environments/environment.spec.ts` in Korbjäger is a real spec).

## Acceptance

1. The spec (`tools/oxlint/workspace-rules.spec.mjs`) reports imports of `@wolsok/shared-firebase-emulator` and `@wolsok/shared-firebase-emulator/rules` in production code, and allows them in a file below `testing/`.
2. The spec allows `@wolsok/shared-firebase-emulator-x`-style lookalikes (another lib's name only sharing the prefix).
3. The spec reports a testing import in `src/environments/environment.emulator.ts` and still allows one in `boards.emulator.ts` and in `src/environments/environment.spec.ts`.
4. `npx nx test oxlint-workspace-rules` passes; `npx nx run-many -t lint` reports no new finding in the workspace (today no production file imports the lib, and `environment.emulator.ts` imports no testing code).
5. CLAUDE.md's description of the rule names the test-only lib list and the narrowed emulator exemption.

## Open questions

None.
