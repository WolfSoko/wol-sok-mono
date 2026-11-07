# Plan #2834: apps/\*-cdk tsconfigs disagree on module settings

Spec: [docs/specs/2834-…](../specs/2834-apps-cdk-tsconfigs-disagree-on-module-settings.md)

## Task 1: show the broken config

- Run `npx tsc -p apps/<app>/tsconfig.{app,spec}.json --noEmit` for the five
  apps: `angular-examples-cdk`'s spec config fails with TS5095/TS5109.

## Task 2: align the tsconfigs

- Files: `apps/{angular-examples,bacteria-game-remote,fourier-analysis-remote,portfolio,shader-examples-remote}-cdk/tsconfig{,.app,.spec}.json`.
- `tsconfig.json`: `NodeNext`/`NodeNext`, `types: ["node"]`, no
  `esModuleInterop`/`resolveJsonModule`.
- `tsconfig.app.json`: drop `module`/`moduleResolution`.
- `bacteria-game-remote-cdk/tsconfig.spec.json`: drop `module: commonjs`.

## Task 3: checks and commit

- Rerun Task 1's tsc calls: all pass.
- `npx nx run-many -t test,lint -p` the five apps; synth check of
  `bacteria-game-remote-cdk` with `tsx`.
- `npx nx format:write`, `npx nx affected -t lint,lint-templates`.
- One commit `chore(nx): align the CDK apps' tsconfig module settings`
  (workspace configuration across five projects, so the `nx` scope), with
  spec and plan. PR to `main` with `Closes #2834`.
