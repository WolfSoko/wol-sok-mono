# CLAUDE.md — wol-sok-mono

Angular + Nx monorepo. Read this before touching anything.

## Stack

- **Angular 20** — standalone components, zoneless change detection, Signals, `@if`/`@for`/`@switch` control flow
- **Nx 23** — monorepo orchestration, caching, affected commands
- **TypeScript 5.9** — strict mode
- **Build**: Vite (Analog/Vitest apps), Webpack + Module Federation (angular-examples)
- **Testing**: Jest (most unit tests), Vitest (Vite projects), Playwright (E2E)
- **Lint / Format**: oxlint (`.oxlintrc.json`, targets inferred by `@nx/oxlint`) and oxfmt (`.oxfmtrc.json`, driven by `nx format`)
- **UI**: Angular Material + CDK everywhere (no custom primitives if AM covers it)
- **State**: Angular Signals (local/sync), RxJS (async), Akita/Elf (app-wide stores)
- **Backend**: Firebase (Hosting, Auth, DB), AWS CDK (S3/CloudFront infra)
- **Package manager**: npm (use `npm ci`, never yarn/pnpm)

## Project Layout

```
apps/                   # Deployable apps
  angular-examples/     # Main showcase (Webpack + Module Federation)
  pacetrainer/          # Pace trainer (Vite + Analog.js)
  rollapolla-analog/    # Analog.js SSR demo
  *-remote/             # Module Federation remotes
  *-cdk/                # AWS CDK infra stacks
libs/
  features/             # Domain features (can use shared + utils + ui-kit)
  shared/               # Cross-cutting concerns (can use utils)
  utils/                # Pure utilities (minimal deps)
  ui-kit/               # Reusable UI components
  public/               # Published npm packages (e.g. @wolsok/thanos)
  fib-wasm/             # WebAssembly modules
  test-helper/          # Testing utilities
tools/                  # Build/deploy node scripts
docs/                   # Architecture, testing, getting-started docs
```

## Essential Commands

```bash
# Install
npm ci

# Serve
npx nx serve pacetrainer
npx nx serve angular-examples

# Build
npx nx build <project> [--configuration production]

# Test
npx nx test <project>
npx nx run <project>:e2e

# Lint (always --fix)
npx nx lint <project> --fix
npm run lint                          # all projects

# Format (REQUIRED before committing)
npx nx format:write

# Affected only (prefer in CI / large PRs)
npx nx affected -t build,test,lint

# Dependency graph
npx nx graph
```

## Coding Rules

1. **Standalone components only** — no NgModules
2. **Zoneless change detection** — never add `zone.js` imports or zone-dependent patterns
3. **Signals for state** — prefer `signal()`/`computed()`/`effect()` over manual subscriptions where possible
4. **OnPush everywhere** — `changeDetection: ChangeDetectionStrategy.OnPush`
5. **Angular Material** — use AM components consistently; don't roll custom UI that AM already covers
6. **Modern control flow** — `@if`, `@for`, `@switch` (not `*ngIf`, `*ngFor`, `*ngSwitch`)
7. **2-space indentation**, kebab-case filenames, `*.spec.ts` for tests
8. **Explicit `public`/`private`** in class members
9. **Strongly typed** — avoid `any`; use proper generics

## Linting & Formatting

- One workspace-wide `.oxlintrc.json`; there are no per-project lint configs. Add project-specific rules through `overrides` with a `files` glob.
- `@nx/enforce-module-boundaries` runs inside oxlint through the `@nx/oxlint/boundaries-plugin` bridge; tag constraints live in `.oxlintrc.json`.
- oxlint only lints JS/TS. Angular template rules, component/directive selector checks and the JSON-based `@nx/dependency-checks` rule from the old ESLint setup are gone; keep selectors and package.json deps correct by hand.
- `nx format:write` / `nx format:check` run oxfmt (HTML, SCSS, Markdown and YAML are formatted through its Prettier-backed path).

## Dependency Constraints

```
apps        → features, shared, utils, ui-kit
features    → shared, utils, ui-kit
shared      → utils
utils       → (minimal external deps only)
public      → (own deps only, published packages)
```

Do not create circular dependencies. Run `npx nx graph` to verify.

## Target Policy

- Root `.browserslistrc` and `tsconfig.base.json` govern everything — apps/libs inherit.
- **Do not bump targets in `libs/public/*`** — published packages, held back for consumer compat.
- **`apps/*-cdk` use `target: "ESNext"`** intentionally (Node runtime) — exclude from browser-target changes.

## Native Federation

- `angular-examples` is the shell, remotes are `fourier-analysis-remote`, `bacteria-game-remote`, `shader-examples-remote`.
- Shared setup lives in `tools/federation/workspace-federation.js`; each app's `federation.config.js` only adds its name and `exposes`. A package skipped in one app must be skipped in all of them, or the shell and a remote disagree about the import map.
- `exposes` paths resolve from the workspace root (`./apps/<app>/src/...`), not the project root.
- **Nothing but the exposed module belongs in `src/app/remote-entry/`.** Native Federation maps the whole _directory_ of an exposed file to the remote's public name, so a sibling file imported with a static `import` from outside that folder is rewritten to `<remote>/Routes` and its exports vanish at runtime. That is why each remote's bootstrap component sits in `src/app/`, not next to `entry.routes.ts`.
- A remote also has to run standalone (its own e2e serves it that way), so check both: loaded through the shell _and_ opened on its own port.
- Remotes are listed in `apps/angular-examples/src/assets/federation.manifest.json` (dev) and `federation.manifest.prod.json` (prod).
- Each app has an `esbuild` target (`@angular/build:application`) wrapped by a `build`/`serve` target from `@angular-architects/native-federation`. Change build options on `esbuild`.
- `nx serve angular-examples` only serves the shell. Use `nx run angular-examples:serve-all` to boot the shell plus all remotes (ports 4200-4203).

## Testing

- **Unit (Jest)**: colocated as `<file>.spec.ts`; mock external services; keep fast and deterministic
- **Unit (Vitest)**: used in Vite-based projects (check `project.json` for the `@nx/vitest` plugin / `@nx/vitest:test` executor)
- **E2E (Playwright)**: in `apps/<app>/e2e/`; page objects in `e2e/pos/`, fixtures in `e2e/fixtures/`
- **Plugin E2E (Jest)**: `apps/nx-aws-cdk-v2-e2e` exercises `@wolsok/nx-aws-cdk-v2` in a generated throwaway workspace. Its target is `e2e` (not `e2e-ci`), so CI does not run it — run `npx nx e2e nx-aws-cdk-v2-e2e` by hand after changing the plugin
- Run `npx nx affected -t test` before pushing

## Commits & PRs

- **Conventional Commits** enforced by commitlint: `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`
- **Valid scopes** = any Nx project name (`npx nx show projects`) + `release`, `nx`, `github`, `dev-deps`, `deps`, `tools`. No free-form scopes (e.g. `mf`, `ui` will be rejected).
- Pre-commit: Husky + lint-staged (runs automatically)
- **Before every commit**:
  1. `npx nx format:write`
  2. `npx nx affected -t lint`
- PR scope: include summary, UI screenshots if visual, linked issue; no unrelated refactors
- **Always request a CodeRabbit review** after opening a PR: this repo gets no automatic reviews
  (fewer than 10 stars), so comment `@coderabbitai review` on the PR and work through the findings

## Security

- No secrets in source. Use `apps/<app>/src/environments/` for env config.
- Review `SECURITY.md` for guidelines.
- Don't commit `.env` files or Firebase service account keys.

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->

<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax

<!-- nx configuration end-->
