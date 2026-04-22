# Repository Guidelines

## Project Structure & Module Organization

- Monorepo managed by Nx. Apps live under `apps/<app-name>` (e.g., `apps/pacetrainer`, `apps/rollapolla-analog`, `apps/fourier-analysis-remote`).
- Source per app: `src/` (components, routes, styles). Assets under `src/public` or `src/assets`.
- Unit tests: colocated as `*.spec.ts`. E2E tests: `apps/<app>/e2e` with Playwright configs in each app.
- Root config: `nx.json`, `package.json`, `eslint*`, `jest*`, `.prettierrc.json`.

## Build, Test, and Development Commands

- Install deps: `npm ci`
- Serve locally: `npx nx serve pacetrainer` (replace with project name).
- Build app: `npx nx build rollapolla-analog --configuration production`
- Unit tests: `npx nx test pacetrainer`
- E2E tests: `npx nx run pacetrainer:e2e`
- Lint (fix): `npm run lint` or `npx nx lint <project> --fix`
- Visualize projects/deps: `npx nx graph`

## Coding Style & Naming Conventions

- TypeScript + Angular/Analog. Use 2-space indentation.
- Filenames: kebab-case (e.g., `training-live-state.component.ts`); tests end with `.spec.ts`.
- Prefer strongly typed APIs and explicit `public`/`private` in classes.
- Linting: ESLint (`eslint*.config.*`). Formatting: Prettier (`.prettierrc.json`). Pre-commit runs via Husky + lint-staged.
- **IMPORTANT**: Always run `npx nx format:write` before committing to ensure all files are properly formatted.
- **REQUIRED**: Run `npx nx affected -t lint` before pushing to verify all linting issues are resolved. This prevents CI failures.

## Testing Guidelines

- Unit: Jest via Nx (`npx nx test <project>`). Keep tests near code in `src/**`.
- E2E: Playwright in `apps/<app>/e2e` (`npx nx run <project>:e2e`). Store page objects under `e2e/pos` and fixtures under `e2e/fixtures`.
- Name tests descriptively; prefer fast, deterministic tests. Mock external services.

## Commit & Pull Request Guidelines

- Conventional Commits enforced by commitlint (e.g., `feat(pacetrainer): add sprint timer`, `fix(rollapolla-analog): handle null chat message`).
- PRs: include scope, summary, screenshots for UI, and linked issue. Ensure `npm test` and `npm run lint` pass. Avoid unrelated refactors.

## Security & Configuration Tips

- Do not commit secrets. Review `SECURITY.md` and use environment files under `apps/<app>/src/environments/` for config.
- Prefer Nx caching defaults; avoid custom scripts unless necessary. Use `npx nx affected -t build,test,lint` before merging.

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
