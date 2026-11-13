# Plan: bacteria-wars-admin specs typecheck (#3037)

Spec: [docs/specs/3037-bacteria-wars-admin-specs-do-not-typecheck-add-a-typecheck-specs-target.md](../specs/3037-bacteria-wars-admin-specs-do-not-typecheck-add-a-typecheck-specs-target.md).

1. **Add the target (red).** `libs/features/lazy/bacteria-wars-admin/project.json`:
   `"typecheck-specs": {}`. Run `npx nx run feat-lazy-bacteria-wars-admin:typecheck-specs`:
   fails with TS2345 in `overview.component.spec.ts`.
2. **Type the fake from the service (green).**
   `src/lib/overview/overview.component.spec.ts`: `type Send = AdminCommandsService['send']`
   and one helper `fakeSend(result)` (`jest.fn<ReturnType<Send>, Parameters<Send>>`)
   that builds every `send` fake of the spec (the default, the refused refresh, the
   refused recount). `typecheck-specs` and `test` green.
3. **Commit** `fix(feat-lazy-bacteria-wars-admin): typecheck the specs` with spec
   and plan, after `nx format:write` and `nx affected -t lint,lint-templates,test,typecheck-specs`.
