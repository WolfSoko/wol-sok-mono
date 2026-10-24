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
  bacteria-wars-android/ # Android app (Gradle, Trusted Web Activity)
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
- `bacteria-game-remote` runs on Firebase Hosting (`firebase.bacteria-game-remote.json`, site `bacteria-wars`, domain `bacteria-wars.wolsok.de`), deployed by its `deploy` target together with the Firestore and Realtime Database rules. The shell's prod manifest loads the remote from there, and the shell reloads once when a navigation fails on a remote bundle a release replaced (`core/reload-on-stale-bundle.ts`). The old domain `bacteria-game.wolsok.de` is gone; `bacteria-game-remote-cdk` (stack `BacteriaGame`) only holds the new domain's CNAME, whose construct id must stay as it is.
- The game's legal pages live in `bacteria-game-remote`, not the lib: `/privacy` and `/impressum` (`src/app/privacy`, `src/app/impressum`, sharing `src/app/legal/`). Both name the provider from `src/app/legal/site-owner.ts` (name, email, postal address), which also fills `siteOwner` in the support options for the footer's copyright line. The game lib's `support/` folder links to the pages from the footer under the main menu (the route paths are the lib's `legal-links.ts`, used by `app.routes.ts`) and offers the Android app or the PWA in a banner (`InstallOffer`), both only where `provideGameSupport` is set up: on the game's own site, never in the shell.
- Exception: `bacteria-game-remote` is also a standalone PWA. Its federation build is `build-federation`; `build` then reruns `ngsw-config`, since the federation builder writes its files after Angular has hashed the output into `ngsw.json`.
- `nx serve angular-examples` only serves the shell. Use `nx run angular-examples:serve-all` to boot the shell plus all remotes (ports 4200-4203).

## Cloud Functions (Bacteria Wars)

- `apps/bacteria-wars-functions` is the game's server code (ADR 0011, 0012): 2nd-gen functions, codebase `bacteria` in `firebase.bacteria-game-remote.json`, region `REGION` in `src/config.ts` (the Firestore location of `bacteria-wars`). It takes the engine from `@wolsok/feat-lazy-bac-game/engine` and bundles it (`@nx/esbuild`, ESM, `thirdParty: false`); `firebase-admin` and `firebase-functions` stay external, at the versions in the app's own `package.json`, which a spec keeps equal to the workspace's.
- The client never calls a function: it writes command documents (`replaySubmissions`, `replayCommands`) that triggers process. Triggers run with retries off and are idempotent (`create()` or a transaction checks first).
- `test` runs the pure specs; `test-emulator` runs `*.emulator.ts` against the Firestore emulator on ports of its own (`emulator.json`). The game's rules are tested the same way in `apps/bacteria-game-remote/rules-test` (`bacteria-game-remote:test-emulator`). CI runs both targets.
- Handler modules import `firebase-functions/logger`, not `firebase-functions`: the root export loads the admin auth stack, which Jest on Node 22 cannot require.
- There is no `deploy` target yet: functions are deployed by hand (`firebase deploy --only functions:bacteria --config firebase.bacteria-game-remote.json`) until the owner has set up the region, APIs and IAM (ADR 0011, "Owner's manual steps"). The game's hosting deploy leaves them alone (`--only hosting,firestore,database`).

## Android App

- `apps/bacteria-wars-android` is a Gradle project, not a web build: a Trusted Web Activity that opens `https://bacteria-wars.wolsok.de` (the `bacteria-game-remote` PWA) fullscreen in Chrome. Game changes go into the PWA; the app picks them up with the next web deploy.
- Its Nx targets are `apk`, `bundle`, `lint-android` and `deploy`, deliberately not `build`/`lint`/`test`: the Nx Cloud workers have no Android SDK. The `Android app` GitHub workflow (`.github/workflows/android.yml`) builds and lints it on PRs instead. `deploy` signs the release, attaches the APK and bundle to the GitHub release and uploads the bundle to Play's closed testing track (`alpha`); the `android` leg of `deploy.yml` runs it when a release affects the app. See its `README.md` for signing and Play.
- Fullscreen depends on `apps/bacteria-game-remote/src/.well-known/assetlinks.json` naming the app's package and signing-key fingerprints. Gradle reads the package name from that file, so it is the one place to change it; the host is set in `app/build.gradle.kts` and served by Firebase Hosting (`firebase.bacteria-game-remote.json`).
- Launcher icons and splash come from `npx nx run bacteria-game-remote:icons`; don't edit the PNGs by hand.
- `store/` holds what Play shows: the listing texts and graphics, the promo videos and, in `store/play-games/achievements/`, the Play Games Services achievement icons (`npx nx run bacteria-wars-android:achievement-icons`). The achievements themselves are the game's: `play-games-achievements.json` in `libs/features/lazy/bacteria-game/src/lib/state/`, with its spec keeping it in line with the game's achievements. The deploy syncs them to Play as drafts (`tools/bacteria-game/play-games.ts`); the Publish page in Play Console takes them live. Game details and graphics of the Play Games project are the store listing's, entered by hand.
- `app/google-services.json` registers the app with the Firebase project `bacteria-wars` (the `google-services` Gradle plugin, Firebase Analytics, with the advertising id permission removed in the manifest); the Android OAuth client Play Games Services needs lives on that Firebase app. Its `project_number` is also the Play Games Services game id: Gradle puts it into `game_services_project_id` for the manifest's `APP_ID`, the deploy reads it for the achievement sync, and `BacteriaWarsApplication` starts the Play Games SDK, which signs the player in silently on launch. The game itself (in Chrome) cannot reach that SDK; unlocking achievements from the web is still open. The privacy policy (`apps/bacteria-game-remote/src/app/privacy`) names Analytics and the Play Games sign-in; keep it in step with what the app does.
- `tools/bacteria-game/dish.ts` holds the colony palette and the petri dish both icon generators draw with; change colours there.
- Tips and ads live in the game lib's `support/` folder and are switched on by `provideGameSupport` in the remote's app config only, so the shell shows neither. On the web the game links to Buy Me a Coffee; in the app it sells Play tips instead (Play allows no other donation link). The remote's `index.html` loads the AdSense script (it brings Google's consent banner, and AdSense checks the site by it); the game's own ad slots stay off until `environment.prod.ts` sets `support.ads` (publisher id and ad unit). Keep Auto ads off for the subdomain in AdSense, or ads cover the game. The shared tip settings are in `environments/game-support.ts`. Changes to them belong into the privacy policy (`src/app/privacy`) too.

## SEO & Sitemaps

Keep `sitemap.xml` and the SEO tags in shape with every change that adds, renames or removes a page. A page that is public but missing from the sitemap, or listed with the wrong URL, counts as a bug.

- **rollapolla-analog**: `/sitemap.xml` is a Nitro route (`src/server/routes/sitemap.xml.ts`, URLs from `src/server/sitemap/sitemap.ts`). A new indexable page goes into `sitemapUrls`. Every page sets its tags through `usePageTags` / `useNoindexPage` in `src/app/pages/site-tags.ts`: its own title, description and canonical URL, and `noindex` for personal pages. Unknown pages and missing polls answer 404 (`injectSetNotFoundStatus`). Don't put a static `sitemap.xml` in `src/public`, because Firebase Hosting would serve it instead of the route.
- **angular-examples**: `src/sitemap.xml` is kept by hand. It lists every route in `APP_ROUTES`, or its visible tabs when the route redirects to one, since the canonical URL is the URL after the redirect. Every main route needs a `data.description`. `seo.service.spec.ts` checks both: update it together with the sitemap.
- **portfolio** (`wolsok.de`): prerendered (`outputMode: static`), so each route is a page of its own. `public/sitemap.xml` is kept by hand and lists every route in `app.routes.ts` (`app.component.spec.ts` checks it); each route sets `title` and `data.description`, `SeoService` sets canonical and Open Graph tags. A new project goes into `src/app/projects.ts`. `public/ads.txt` and the AdSense tags in `index.html` belong to AdSense; keep them. `portfolio-cdk` uploads each prerendered page a second time under its bare path, because CloudFront serves no folder index.
- **bacteria-game-remote** (`bacteria-wars.wolsok.de`): `src/sitemap.xml` and `src/robots.txt` are kept by hand and shipped as assets. The sitemap lists the game and every page route in `app.routes.ts` (`sitemap.spec.ts` checks it); the legal pages set their tags through `legal/legal-page.ts`, with the origin from the lib's `GAME_SITE_URL`.
- Check the server-rendered HTML, not just the browser: title, description, canonical, robots and HTTP status.

## Testing

- **Unit (Jest)**: colocated as `<file>.spec.ts`; mock external services; keep fast and deterministic
- **Unit (Vitest)**: used in Vite-based projects (check `project.json` for the `@nx/vitest` plugin / `@nx/vitest:test` executor)
- **E2E (Playwright)**: in `apps/<app>/e2e/`; page objects in `e2e/pos/`, fixtures in `e2e/fixtures/`
  - Start every `webServer` through an Nx target (`npx nx serve <app>`, `npx nx run <app>:<target>` for a `continuous` target) with `reuseExistingServer: true`. Only then does `@nx/playwright` make the atomized `e2e-ci--*` tasks depend on those servers and wait for them, so several spec files on one Nx Cloud worker share them. A server Playwright starts itself clashes with the next spec file on the same worker (see `rollapolla-analog`). A static server (`@nx/web:file-server`) serves `staticFilePath` and `dependsOn: ["build"]` with `watch: false`, not a `buildTarget`: with `buildTarget` it runs a nested `nx build`, which Nx refuses as a recursive task invocation inside a shared run. Exception for now: `angular-examples` (the federation shell, one spec file) still lets Playwright start its server in CI; with the inferred serve dependency its page did not render on the Nx Cloud workers, while it passed locally.
- **GPU cross-check (Playwright, no server)**: `libs/features/lazy/bacteria-game/playwright.config.ts` runs the deterministic simulation's integer shaders on SwiftShader against the TypeScript reference, tick by tick (`gpu-crosscheck/`, ADR 0015). It is inferred as the lib's `e2e-ci--*` target, so `nx affected` runs it in CI. The goldens in `golden-gpu-int.json` are regenerated whenever the scenarios, the reference or the hash change; a change to what the passes compute also needs a `BALANCE_VERSION` bump, a scenario change does not; `golden.spec.ts` (Jest) recomputes them from the reference. The same check plays whole matches through the game's `GpuSimulation` (`SIM_SCENARIOS`) against `golden-gpu-sim.json`, which `sim-golden.spec.ts` keeps equal to `IntSimulation`, and runs the on-device self-test; its own hashes are `SELF_TEST_GOLDEN` (`state/gpu-int/self-test-golden.ts`, with `GPU_SELF_TEST_VERSION` bumped on every change), kept in step by `self-test-golden.spec.ts`. `golden-replay.spec.ts` keeps a result of `golden-replay.json` per `BALANCE_VERSION` for each ruleset: `cpu` on `BacteriaSimulation`, `gpu-int` on `IntSimulation`
- **Plugin E2E (Jest)**: `apps/nx-aws-cdk-v2-e2e` exercises `@wolsok/nx-aws-cdk-v2` in a generated throwaway workspace. Its target is `e2e` (not `e2e-ci`), so CI does not run it — run `npx nx e2e nx-aws-cdk-v2-e2e` by hand after changing the plugin
- Run `npx nx affected -t test` before pushing

## Performance Gates

Planned and phased in [ADR 0014](docs/adr/0014-performance-gates-in-ci.md); this section says what is in place. Keep it current with each phase.

- **In place now**: Angular budgets on each app's `esbuild:production` (`initial`, `anyComponentStyle`). CI's `build -c=ci` falls back to `production`, so they run on every affected build. Lazy chunks are not covered yet: the game's chunk in `bacteria-game-remote` (815 kB raw, 181 kB transferred on 2026-10-24) has no budget.
- **Coming, in this order** (one PR each):
  1. `anyScript` (largest single script) and `allScript` (all scripts together) budgets with a measured `baseline` (warning +5%, error +10%), and tightened `initial` budgets, for every app. Blocking.
  2. `perf` target on `feat-lazy-bacteria-game`: a Node benchmark of `engine.ts` on fixed replays (`tools/perf/`), gated on the ratio to a calibration loop against `tools/perf/engine-baseline.json` (fails above +20%). Report-only for two weeks, then blocking.
  3. A Playwright frame-time spec for the game, report-only.
  4. Lighthouse CI for the public pages, report-only.
- **Rules**:
  - A failing gate is fixed in the code, not by raising the limit. Raise a budget or baseline only for growth you want, in its own `perf(<project>): ...` commit, with what grew, by how much and why in the PR body. Lower it when a gate reports a gain.
  - Don't compare absolute milliseconds from CI: the Nx Cloud workers are shared and vary. Runtime gates compare against a calibration loop run in the same process.
  - CI has no GPU. A change to the GPU simulation or the GL painters needs a manual check on a real device, noted in the PR.
  - New engine code must stay cheap per tick: online matches, replays, ranked matches and the Cloud Functions' verification all run the CPU simulation.

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
