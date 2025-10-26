# E2E Testing with Playwright

This repository uses [Playwright](https://playwright.dev/) for end-to-end testing across all applications.

## Overview

All applications in the monorepo have Playwright E2E tests configured through the `@nx/playwright` plugin:

- **angular-examples**
- **pacetrainer**
- **bacteria-game-remote**  
- **fourier-analysis-remote**
- **rollapolla-analog**

## Running E2E Tests

### Run E2E tests for a specific project

```bash
npx nx e2e <project-name>
```

Example:
```bash
npx nx e2e angular-examples
npx nx e2e pacetrainer
```

### Run all E2E tests

```bash
npx nx run-many -t e2e
```

### Run E2E tests for affected projects only

```bash
npx nx affected -t e2e
```

### Run E2E tests in CI mode

```bash
npx nx run-many -t e2e-ci
```

## Test Structure

Each app with E2E tests has:

- `apps/<app-name>/e2e/` - Test files directory
- `apps/<app-name>/playwright.config.ts` - Playwright configuration
- `apps/<app-name>/e2e/**/*.spec.ts` - Test spec files

### Example Test Structure

```
apps/angular-examples/
├── e2e/
│   ├── home.spec.ts          # Test specs
│   └── po/                   # Page Object Models
│       └── angular-examples.page.ts
└── playwright.config.ts      # Playwright config
```

## Writing E2E Tests

Tests use the Playwright Test framework:

```typescript
import { test, expect } from '@playwright/test';

test('has main title', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toContainText('Expected Title');
});
```

## Configuration

Playwright configuration is defined per-app in `playwright.config.ts`:

- **Base URL**: Automatically set to the dev server URL
- **Web Server**: Automatically starts the app before tests run
- **Browsers**: Tests run on Chromium and Firefox by default
- **Timeout**: 120 seconds per test
- **Retries**: Configured for CI environments

## CI Integration

E2E tests are automatically run in the CI/CD pipeline via the `.github/workflows/ci-cd.yml` workflow.

The workflow runs:
```bash
npx nx affected -t e2e-ci --parallel=1
```

## Debugging

### Run tests in headed mode

```bash
npx nx e2e <project-name> -- --headed
```

### Run specific test file

```bash
npx nx e2e <project-name> -- e2e/home.spec.ts
```

### Debug with Playwright Inspector

```bash
npx nx e2e <project-name> -- --debug
```

### View test reports

Test reports are generated in `dist/.playwright/<project-name>/playwright-report/`

To view:
```bash
npx playwright show-report dist/.playwright/<project-name>/playwright-report
```

## Notes

- **Karma**: Karma is still used for **unit tests** (not E2E tests) in some libraries like `ws-thanos`. This is expected and correct.
- **Nx Plugin**: The `@nx/playwright` plugin automatically infers E2E targets for projects with a `playwright.config.ts` file.
- **No Manual Setup Needed**: E2E targets are auto-configured by Nx based on the presence of Playwright config files.
