# CLAUDE.md — wol-sok-mono

Angular + Nx monorepo. Read this before touching anything.

## Stack

- **Angular 20** — standalone components, zoneless change detection, Signals, `@if`/`@for`/`@switch` control flow
- **Nx 22** — monorepo orchestration, caching, affected commands
- **TypeScript 5.9** — strict mode
- **Build**: Vite (Analog/Vitest apps), Webpack + Module Federation (angular-examples)
- **Testing**: Jest (most unit tests), Vitest (Vite projects), Playwright (E2E)
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

## Dependency Constraints

```
apps        → features, shared, utils, ui-kit
features    → shared, utils, ui-kit
shared      → utils
utils       → (minimal external deps only)
public      → (own deps only, published packages)
```

Do not create circular dependencies. Run `npx nx graph` to verify.

## Testing

- **Unit (Jest)**: colocated as `<file>.spec.ts`; mock external services; keep fast and deterministic
- **Unit (Vitest)**: used in Vite-based projects (check `project.json` for `@nx/vite:test` executor)
- **E2E (Playwright)**: in `apps/<app>/e2e/`; page objects in `e2e/pos/`, fixtures in `e2e/fixtures/`
- Run `npx nx affected -t test` before pushing

## Commits & PRs

- **Conventional Commits** enforced by commitlint: `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`
- Pre-commit: Husky + lint-staged (runs automatically)
- **Before every commit**:
  1. `npx nx format:write`
  2. `npx nx affected -t lint`
- PR scope: include summary, UI screenshots if visual, linked issue; no unrelated refactors

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
