# Testing Guide

This guide covers testing practices, strategies, and conventions used in the wol-sok-mono repository.

## Table of Contents

- [Testing Philosophy](#testing-philosophy)
- [Testing Stack](#testing-stack)
- [Unit Testing](#unit-testing)
- [E2E Testing](#e2e-testing)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Coverage](#test-coverage)
- [Best Practices](#best-practices)

## Testing Philosophy

We follow these testing principles:

1. **Test behavior, not implementation**: Focus on what the code does, not how it does it
2. **Fast feedback**: Tests should run quickly for rapid iteration
3. **Deterministic**: Tests should produce consistent results
4. **Isolated**: Tests should not depend on external services or other tests
5. **Readable**: Tests should clearly document expected behavior
6. **Maintainable**: Tests should be easy to update when requirements change

## Testing Stack

### Unit Testing

- **Jest 30.2.0**: JavaScript testing framework
- **@ngneat/spectator 22.0.0**: Angular testing utilities
- **jest-preset-angular 15.0.3**: Jest preset for Angular
- **Vitest 4.0.3**: Vite-native testing (for Analog.js projects)

### E2E Testing

- **Playwright 1.56.1**: Browser automation
- **@nx/playwright**: Nx integration for Playwright

### Test Utilities

- **jest-canvas-mock**: Mock Canvas API for graphics tests
- **jest-mock-extended**: Enhanced mocking capabilities
- **firebase-functions-test**: Firebase Functions testing utilities

## Unit Testing

### Test File Location

Unit tests are **colocated** with source files using the `.spec.ts` extension:

```
src/
├── app/
│   ├── app.component.ts
│   ├── app.component.spec.ts      ✓ Component test
│   ├── services/
│   │   ├── user.service.ts
│   │   └── user.service.spec.ts   ✓ Service test
```

### Running Unit Tests

```bash
# Test a specific project
npx nx test pacetrainer

# Test in watch mode (re-run on file changes)
npx nx test pacetrainer --watch

# Test with coverage
npx nx test pacetrainer --coverage

# Test all projects
npx nx run-many -t test

# Test only affected projects
npx nx affected -t test
```

### Test Configuration

Each project has its own Jest configuration:

- `jest.config.ts` in the project root
- Extends workspace preset: `jest.preset.cjs`
- Global config: `jest.config.ts` at workspace root

### Basic Test Structure

```typescript
import { TestBed } from '@angular/core/testing';
import { MyComponent } from './my-component.component';

describe('MyComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyComponent], // Standalone component
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(MyComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should display title', () => {
    const fixture = TestBed.createComponent(MyComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('My Title');
  });
});
```

### Testing Components

#### Using Spectator (Recommended)

```typescript
import { Spectator, createComponentFactory } from '@ngneat/spectator';
import { MyComponent } from './my-component.component';

describe('MyComponent', () => {
  let spectator: Spectator<MyComponent>;
  const createComponent = createComponentFactory({
    component: MyComponent,
    shallow: true, // Don't render child components
  });

  beforeEach(() => {
    spectator = createComponent();
  });

  it('should render title', () => {
    expect(spectator.query('h1')).toHaveText('My Title');
  });

  it('should emit event on button click', () => {
    let emittedValue: string | undefined;
    spectator.output('myEvent').subscribe((value: string) => {
      emittedValue = value;
    });

    spectator.click('button');
    expect(emittedValue).toBe('clicked');
  });
});
```

#### Testing with Signals

```typescript
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

describe('SignalComponent', () => {
  it('should update signal value', () => {
    const fixture = TestBed.createComponent(SignalComponent);
    const component = fixture.componentInstance;

    // Initial value
    expect(component.counter()).toBe(0);

    // Update signal
    component.counter.set(5);
    fixture.detectChanges();

    expect(component.counter()).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('5');
  });
});
```

#### Testing with OnPush Change Detection

```typescript
it('should update with OnPush', () => {
  const fixture = TestBed.createComponent(MyOnPushComponent);
  const component = fixture.componentInstance;

  // Manually trigger change detection
  component.someInput = 'new value';
  fixture.detectChanges();

  expect(fixture.nativeElement.textContent).toContain('new value');
});
```

### Testing Services

```typescript
import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { UserService } from './user.service';

describe('UserService', () => {
  let service: UserService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UserService, provideHttpClientTesting()],
    });

    service = TestBed.inject(UserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify(); // Ensure no outstanding requests
  });

  it('should fetch users', () => {
    const mockUsers = [{ id: 1, name: 'John' }];

    service.getUsers().subscribe((users) => {
      expect(users).toEqual(mockUsers);
    });

    const req = httpMock.expectOne('/api/users');
    expect(req.request.method).toBe('GET');
    req.flush(mockUsers);
  });
});
```

### Testing RxJS Observables

```typescript
import { TestScheduler } from 'rxjs/testing';

describe('Observable operators', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  it('should delay values', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const input$ = cold('a-b-c|');
      const expected = '   ---a-b-c|';

      const output$ = input$.pipe(delay(30, scheduler));

      expectObservable(output$).toBe(expected);
    });
  });
});
```

### Mocking Dependencies

```typescript
import { createSpyObj } from 'jest-auto-spies';

describe('ComponentWithDeps', () => {
  it('should use mocked service', () => {
    const mockService = {
      getData: jest.fn().mockReturnValue('mocked data'),
    };

    TestBed.configureTestingModule({
      imports: [MyComponent],
      providers: [{ provide: DataService, useValue: mockService }],
    });

    const fixture = TestBed.createComponent(MyComponent);
    fixture.detectChanges();

    expect(mockService.getData).toHaveBeenCalled();
  });
});
```

### Testing State Management (Akita)

```typescript
import { MyStore } from './my.store';
import { MyQuery } from './my.query';

describe('MyStore', () => {
  let store: MyStore;
  let query: MyQuery;

  beforeEach(() => {
    store = new MyStore();
    query = new MyQuery(store);
  });

  afterEach(() => {
    store.destroy();
  });

  it('should update state', () => {
    store.update({ name: 'John' });
    expect(query.getValue().name).toBe('John');
  });
});
```

## E2E Testing

### Test File Location

E2E tests are in the `e2e/` directory within each app:

```
apps/pacetrainer/
├── e2e/
│   ├── src/
│   │   ├── example.spec.ts       # Test files
│   ├── fixtures/
│   │   └── test-data.json        # Test data
│   └── playwright.config.ts      # Playwright config
```

### Running E2E Tests

```bash
# Run E2E tests for an app
npx nx run pacetrainer:e2e

# Run in UI mode (interactive)
npx nx run pacetrainer:e2e --ui

# Run in headed mode (see browser)
npx nx run pacetrainer:e2e --headed

# Run specific test file
npx nx run pacetrainer:e2e --grep "login"

# Debug tests
npx nx run pacetrainer:e2e --debug
```

### Basic E2E Test

```typescript
import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display welcome message', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Welcome');
  });

  test('should navigate to about page', async ({ page }) => {
    await page.click('text=About');
    await expect(page).toHaveURL(/.*about/);
  });
});
```

### Page Object Pattern

Create reusable page objects in `e2e/pos/`:

```typescript
// e2e/pos/login.page.ts
import { Page, Locator } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.submitButton = page.locator('button[type="submit"]');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

Use in tests:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pos/login.page';

test('should login successfully', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login('user@example.com', 'password123');

  await expect(page).toHaveURL('/dashboard');
});
```

### Testing with Fixtures

```typescript
// e2e/fixtures/users.json
{
  "testUser": {
    "email": "test@example.com",
    "password": "test123"
  }
}
```

```typescript
import { test } from '@playwright/test';
import testUsers from '../fixtures/users.json';

test('login with fixture data', async ({ page }) => {
  const { email, password } = testUsers.testUser;
  // Use fixture data in test
});
```

## Test Coverage

### Generating Coverage Reports

```bash
# Generate coverage for a project
npx nx test pacetrainer --coverage

# Coverage report location
# coverage/apps/pacetrainer/index.html
```

### Coverage Configuration

Coverage settings in `jest.config.ts`:

```typescript
export default {
  coverageDirectory: '../../coverage/apps/pacetrainer',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/test-setup.ts',
  ],
  coverageThresholds: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
```

### CI Coverage

- Coverage reports are uploaded to [Codecov](https://codecov.io/github/WolfSoko/wol-sok-mono)
- Coverage badge in README shows current coverage percentage
- Pull requests show coverage changes

## Best Practices

### 1. Test Naming

Use descriptive test names that explain behavior:

```typescript
// ✓ Good
it('should display error message when login fails', () => {});
it('should disable submit button when form is invalid', () => {});

// ✗ Bad
it('test login', () => {});
it('works', () => {});
```

### 2. Arrange-Act-Assert Pattern

Structure tests clearly:

```typescript
it('should calculate total price', () => {
  // Arrange: Set up test data
  const cart = new Cart();
  cart.addItem({ price: 10, quantity: 2 });
  cart.addItem({ price: 5, quantity: 1 });

  // Act: Execute the behavior
  const total = cart.calculateTotal();

  // Assert: Verify the result
  expect(total).toBe(25);
});
```

### 3. Mock External Dependencies

Don't make real HTTP calls or access real databases:

```typescript
// ✓ Good: Mock HTTP client
TestBed.configureTestingModule({
  providers: [provideHttpClientTesting()],
});

// ✗ Bad: Real HTTP calls in tests
// (slow, unreliable, requires network)
```

### 4. Test One Thing at a Time

Each test should verify a single behavior:

```typescript
// ✓ Good: Separate tests for separate behaviors
it('should validate email format', () => {});
it('should validate email is required', () => {});

// ✗ Bad: Testing multiple things
it('should validate email', () => {
  // Tests both format and required
});
```

### 5. Avoid Test Interdependence

Tests should not rely on execution order:

```typescript
// ✗ Bad: Tests depend on shared state
let counter = 0;
it('increments counter', () => {
  counter++;
  expect(counter).toBe(1); // Fails if tests run in different order
});

// ✓ Good: Each test is independent
it('increments counter', () => {
  const counter = 0;
  const result = counter + 1;
  expect(result).toBe(1);
});
```

### 6. Use Appropriate Matchers

Choose specific matchers for clearer error messages:

```typescript
// ✓ Good: Specific matchers
expect(user.age).toBeGreaterThan(18);
expect(array).toHaveLength(3);
expect(string).toContain('hello');

// ✗ Less clear
expect(user.age > 18).toBe(true);
expect(array.length === 3).toBe(true);
```

### 7. Test Edge Cases

Don't just test the happy path:

```typescript
describe('divide function', () => {
  it('should divide positive numbers', () => {});
  it('should divide negative numbers', () => {});
  it('should handle division by zero', () => {});
  it('should handle very large numbers', () => {});
  it('should handle decimal numbers', () => {});
});
```

### 8. Keep Tests Fast

- Mock slow operations (HTTP, database, file I/O)
- Use `shallow` rendering when possible
- Avoid unnecessary `async` operations
- Run only affected tests during development

### 9. Cleanup After Tests

```typescript
afterEach(() => {
  // Clean up subscriptions
  // Reset mocks
  // Clear state stores
  jest.clearAllMocks();
});
```

### 10. Use Test Utilities

Leverage the test-helper library:

```typescript
import { mockUser } from '@wolsok/test-helper';

it('should handle user data', () => {
  const user = mockUser({ name: 'John' });
  // Test with mock user
});
```

## Debugging Tests

### Debug in VS Code

1. Add breakpoint in test file
2. Run "Debug Jest Tests" from Run menu
3. Or add launch configuration:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "${file}"],
  "console": "integratedTerminal"
}
```

### Debug Playwright Tests

```bash
# Run with debugger
npx nx run pacetrainer:e2e --debug

# Use Playwright Inspector
PWDEBUG=1 npx nx run pacetrainer:e2e
```

### Verbose Output

```bash
# Show detailed test output
npx nx test pacetrainer --verbose

# Show console.log statements
npx nx test pacetrainer --silent=false
```

## Common Testing Patterns

### Testing Async Code

```typescript
it('should load data asynchronously', async () => {
  const promise = service.fetchData();
  expect(service.loading()).toBe(true);

  const data = await promise;
  expect(data).toBeDefined();
  expect(service.loading()).toBe(false);
});
```

### Testing Error Handling

```typescript
it('should handle errors gracefully', () => {
  const mockService = {
    getData: jest.fn().mockRejectedValue(new Error('Network error')),
  };

  component.loadData();

  expect(component.error()).toBe('Failed to load data');
});
```

### Testing Router Navigation

```typescript
import { Router } from '@angular/router';
import { Location } from '@angular/common';

it('should navigate to detail page', async () => {
  const router = TestBed.inject(Router);
  const location = TestBed.inject(Location);

  await router.navigate(['/detail', '123']);

  expect(location.path()).toBe('/detail/123');
});
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Angular Testing Guide](https://angular.dev/guide/testing)
- [Spectator Documentation](https://ngneat.github.io/spectator/)

## Getting Help

If you have questions about testing:

- Check existing test files for examples
- Review this guide and linked resources
- Ask in team discussions or issues

Happy testing! 🧪
