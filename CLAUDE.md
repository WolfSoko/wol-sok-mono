# CLAUDE.md — wol-sok-mono

Angular + Nx monorepo. Read this before touching anything.

## Stack

- **Angular 20** — standalone components, zoneless change detection, Signals, `@if`/`@for`/`@switch` control flow
- **Nx 23** — monorepo orchestration, caching, affected commands
- **TypeScript 5.9** — strict mode
- **Build**: Vite (Analog/Vitest apps), Webpack + Module Federation (angular-examples)
- **Testing**: Jest (most unit tests), Vitest (Vite projects), Playwright (E2E)
- **Lint / Format**: oxlint (`.oxlintrc.json`, targets inferred by `@nx/oxlint`), angular-eslint for templates only (`eslint.config.mjs`, target `lint-templates`) and oxfmt (`.oxfmtrc.json`, driven by `nx format`)
- **UI**: Angular Material + CDK everywhere (no custom primitives if AM covers it)
- **State**: Angular Signals (local/sync), RxJS (async), NgRx Signal Store (bacteria game), Akita/Elf (older app-wide stores)
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
  bacteria-game-android/ # Android app (Gradle, Trusted Web Activity)
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
npx nx lint <project> --fix            # oxlint
npx nx lint-templates <project> --fix  # angular-eslint template rules
npm run lint                          # all projects, both targets

# Format (REQUIRED before committing)
npx nx format:write

# Affected only (prefer in CI / large PRs)
npx nx affected -t build,test,lint,lint-templates

# Dependency graph
npx nx graph
```

## Coding Rules

1. **Standalone components only** — no NgModules
2. **Zoneless change detection** — never add `zone.js` imports or zone-dependent patterns
3. **Signals for state** — prefer `signal()`/`computed()`/`effect()` over manual subscriptions where possible
4. **OnPush everywhere** — `changeDetection: ChangeDetectionStrategy.OnPush`
5. **Angular Material** — use AM components consistently; don't roll custom UI that AM already covers
   - Exception (pacetrainer): the countdown ring (`pace-countdown-circle`) is a custom SVG, since `mat-progress-spinner` has no track ring
6. **Modern control flow** — `@if`, `@for`, `@switch` (not `*ngIf`, `*ngFor`, `*ngSwitch`)
7. **2-space indentation**, kebab-case filenames, `*.spec.ts` for tests
8. **Explicit `public`/`private`** in class members
9. **Strongly typed** — avoid `any`; use proper generics

## Linting & Formatting

- One workspace-wide `.oxlintrc.json`; there are no per-project lint configs. Add project-specific rules through `overrides` with a `files` glob.
- Type-aware linting is on (`options.typeAware`, backed by `oxlint-tsgolint`). It reads each project's `tsconfig.json` with TypeScript 7 semantics: no `baseUrl`, `paths` relative to `tsconfig.base.json` (`./libs/...`), and no `moduleResolution: node`/`node10`. Keep new tsconfigs on that layout or lint reports `tsconfig-error`.
- `@nx/enforce-module-boundaries` runs inside oxlint through the `@nx/oxlint/boundaries-plugin` bridge; tag constraints live in `.oxlintrc.json`.
- oxlint only lints JS/TS. Angular templates are covered by a second, template-only ESLint setup: the root `eslint.config.mjs` (angular-eslint template rules for `.html` and inline templates, plus the per-project component/directive selector prefixes) is inferred as the `lint-templates` target by `@nx/eslint/plugin`. New Angular projects get their selector prefix added to `selectorPrefixes` in that file. The JSON-based `@nx/dependency-checks` rule is gone; keep package.json deps correct by hand.
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
- `bacteria-game-remote` is moving to Firebase Hosting (`firebase.bacteria-game-remote.json`, site `bacteria-wars`, domain `bacteria-wars.wolsok.de`), deployed by its `deploy` target together with the Firestore rules. Until that domain is live, `bacteria-game-remote-cdk` keeps serving `bacteria-game.wolsok.de` from S3/CloudFront and only adds the new domain's DNS records; then the old domain turns into a redirect and the shell manifest and the Android host move over.
- Exception: `bacteria-game-remote` is also a standalone PWA. Its federation build is `build-federation`; `build` then reruns `ngsw-config`, since the federation builder writes its files after Angular has hashed the output into `ngsw.json`.
- `nx serve angular-examples` only serves the shell. Use `nx run angular-examples:serve-all` to boot the shell plus all remotes (ports 4200-4203).

## Android App

- `apps/bacteria-game-android` is a Gradle project, not a web build: a Trusted Web Activity that opens `https://bacteria-game.wolsok.de` (the `bacteria-game-remote` PWA) fullscreen in Chrome. Game changes go into the PWA; the app picks them up with the next web deploy.
- Its Nx targets are `apk`, `bundle` and `lint-android`, deliberately not `build`/`lint`/`test`: the Nx agents and the release workflow have no Android SDK. The `Android app` GitHub workflow (`.github/workflows/android.yml`) builds it instead. See its `README.md` for signing and Play.
- Fullscreen depends on `apps/bacteria-game-remote/src/.well-known/assetlinks.json` naming the app's package and signing-key fingerprints. Gradle reads the package name from that file, so it is the one place to change it; the host is set in both `app/build.gradle.kts` and the CDK stack.
- Launcher icons and splash come from `npx nx run bacteria-game-remote:icons`; don't edit the PNGs by hand.

## SEO & Sitemaps

Keep `sitemap.xml` and the SEO tags in shape with every change that adds, renames or removes a page. A page that is public but missing from the sitemap, or listed with the wrong URL, counts as a bug.

- **rollapolla-analog**: `/sitemap.xml` is a Nitro route (`src/server/routes/sitemap.xml.ts`, URLs from `src/server/sitemap/sitemap.ts`). A new indexable page goes into `sitemapUrls`. Every page sets its tags through `usePageTags` / `useNoindexPage` in `src/app/pages/site-tags.ts`: its own title, description and canonical URL, and `noindex` for personal pages. Unknown pages and missing polls answer 404 (`injectSetNotFoundStatus`). Don't put a static `sitemap.xml` in `src/public`, because Firebase Hosting would serve it instead of the route.
- **angular-examples**: `src/sitemap.xml` is kept by hand. It lists every route in `APP_ROUTES`, or its visible tabs when the route redirects to one, since the canonical URL is the URL after the redirect. Every main route needs a `data.description`. `seo.service.spec.ts` checks both: update it together with the sitemap.
- Check the server-rendered HTML, not just the browser: title, description, canonical, robots and HTTP status.

## Testing

- **Unit (Jest)**: colocated as `<file>.spec.ts`; mock external services; keep fast and deterministic
- **Unit (Vitest)**: used in Vite-based projects (check `project.json` for the `@nx/vitest` plugin / `@nx/vitest:test` executor)
- **E2E (Playwright)**: in `apps/<app>/e2e/`; page objects in `e2e/pos/`, fixtures in `e2e/fixtures/`
  - Start every `webServer` through an Nx target (`npx nx serve <app>`, `npx nx run <app>:<target>` for a `continuous` target) with `reuseExistingServer: true`. Only then does `@nx/playwright` make the atomized `e2e-ci--*` tasks depend on those servers and wait for them, so several spec files on one CI agent share them. A server Playwright starts itself clashes with the next spec file on the same agent (see `rollapolla-analog`). A static server (`@nx/web:file-server`) serves `staticFilePath` and `dependsOn: ["build"]` with `watch: false`, not a `buildTarget`: with `buildTarget` it runs a nested `nx build`, which Nx refuses as a recursive task invocation inside a shared run. Exception for now: `angular-examples` (the federation shell, one spec file) still lets Playwright start its server in CI; with the inferred serve dependency its page did not render on the Nx agents, while it passed locally.
- **Plugin E2E (Jest)**: `apps/nx-aws-cdk-v2-e2e` exercises `@wolsok/nx-aws-cdk-v2` in a generated throwaway workspace. Its target is `e2e` (not `e2e-ci`), so CI does not run it — run `npx nx e2e nx-aws-cdk-v2-e2e` by hand after changing the plugin
- Run `npx nx affected -t test` before pushing

## Commits & PRs

- **Conventional Commits** enforced by commitlint: `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`
- **Valid scopes** = any Nx project name (`npx nx show projects`) + `release`, `nx`, `github`, `dev-deps`, `deps`, `tools`. No free-form scopes (e.g. `mf`, `ui` will be rejected).
- Pre-commit: Husky + lint-staged (runs automatically)
- **Before every commit**:
  1. `npx nx format:write`
  2. `npx nx affected -t lint,lint-templates`
- PR scope: include summary, UI screenshots if visual, linked issue; no unrelated refactors
- **Always request a CodeRabbit review** after opening a PR: this repo gets no automatic reviews
  (fewer than 10 stars), so comment `@coderabbitai review` on the PR and work through the findings
- **When CodeRabbit and Codex are both rate-limited**, don't wait for them: review the change
  yourself (`/code-review`) and run `/simplify` on it, then fix what they find
- **Merge it yourself once it is done**: `/code-review` and `/simplify` findings applied, every
  review thread answered or resolved, and CI green on the current head. Squash-merge (the
  history on `main` is one commit per PR). A human approval is not part of "done" here

## Security

- No secrets in source. Use `apps/<app>/src/environments/` for env config.
- Review `SECURITY.md` for guidelines.
- Don't commit `.env` files or Firebase service account keys.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues (WolfSoko/wol-sok-mono) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

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
