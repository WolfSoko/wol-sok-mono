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

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors

# CI Error Guidelines

If the user wants help with fixing an error in their CI pipeline, use the following flow:

- Retrieve the list of current CI Pipeline Executions (CIPEs) using the `nx_cloud_cipe_details` tool
- If there are any errors, use the `nx_cloud_fix_cipe_failure` tool to retrieve the logs for a specific task
- Use the task logs to see what's wrong and help the user fix their problem. Use the appropriate tools if necessary
- Make sure that the problem is fixed by running the task that you passed into the `nx_cloud_fix_cipe_failure` tool

<!-- nx configuration end-->
