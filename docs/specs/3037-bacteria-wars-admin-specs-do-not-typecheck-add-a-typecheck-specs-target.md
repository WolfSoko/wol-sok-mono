# Spec: bacteria-wars-admin specs typecheck (#3037)

Issue: [#3037](https://github.com/WolfSoko/wol-sok-mono/issues/3037), found during [#2900](https://github.com/WolfSoko/wol-sok-mono/issues/2900).

## Goal

The specs of `feat-lazy-bacteria-wars-admin` typecheck, and CI keeps them so.

## Non-goals

- No change to the admin's production code or behaviour.
- No spec typecheck for other projects without one.

## Decisions

- **The fake of `AdminCommandsService.send` takes its type from the service.**
  `overview.component.spec.ts` types the default `send` from its first fake
  (`{ type: string }` in, `{ ok: true }` out), so the refused-refresh test's
  `jest.fn(async () => ({ ok: false, error }))` no longer fits (TS2345).
  Typing the fake as `jest.fn<ReturnType<Send>, Parameters<Send>>` with
  `Send = AdminCommandsService['send']` fixes the root cause: every fake in
  the spec follows the real signature, rather than the first fake written.
- **An empty `"typecheck-specs": {}` target** in the lib's `project.json`, as
  `feat-lazy-bacteria-game` has; command, inputs and caching come from
  `targetDefaults` in `nx.json`, and CI's `nx affected -t` list and
  `.nx/ci-config.yaml` already name the target.

## Acceptance

1. `npx nx run feat-lazy-bacteria-wars-admin:typecheck-specs` passes.
2. `npx nx test feat-lazy-bacteria-wars-admin` stays green.
3. Lint (`lint`, `lint-templates`) and `nx format:check` stay green.

## Open questions

None.
