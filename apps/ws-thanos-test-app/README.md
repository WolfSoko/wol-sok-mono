# WsThanos Test Application

This is a dedicated test application for the `@wolsok/ws-thanos` directive. It provides a real browser environment for testing the directive's vaporization effects with Playwright E2E tests.

## Purpose

The WsThanos directive uses browser-specific features that cannot be properly tested with Jest + jsdom:

- `html2canvas` for capturing DOM elements as canvas
- Canvas 2D rendering for particle animations
- `window.getComputedStyle` for CSS transitions
- `requestAnimationFrame` for smooth animations

This small Angular application allows us to test these features in a real browser using Playwright.

## Running the Application

### Development Server

```bash
npx nx serve ws-thanos-test-app
```

Then open http://localhost:4350 in your browser.

### E2E Tests

```bash
# Run tests in headless mode
npx nx e2e ws-thanos-test-app

# Run tests in headed mode (watch the browser)
npx nx e2e ws-thanos-test-app -- --headed

# Run tests in UI mode (interactive debugging)
npx nx e2e ws-thanos-test-app -- --ui
```

## Test Coverage

The E2E tests cover:

1. **Basic Rendering** - Verify the test app and directive render correctly
2. **Vaporize and Remove** - Element is vaporized and removed from DOM
3. **Vaporize and Restore** - Element is vaporized and fades back in
4. **Canvas Overlay** - Canvas is created during vaporization and cleaned up after
5. **Multiple Elements** - Multiple elements can be vaporized simultaneously
6. **Rapid Consecutive Vaporizations** - Handle rapid button clicks gracefully

## Application Structure

```
apps/ws-thanos-test-app/
├── e2e/
│   └── ws-thanos.spec.ts          # Playwright E2E tests
├── src/
│   ├── index.html                  # HTML entry point
│   ├── main.ts                     # Angular bootstrap with test component
│   └── styles.css                  # Global styles
├── playwright.config.ts            # Playwright configuration
├── project.json                    # Nx project configuration
└── tsconfig.*.json                 # TypeScript configurations
```

## Test App Features

The application provides three test scenarios:

### Test 1: Vaporize and Remove

- Demonstrates element being completely removed from DOM after vaporization
- Shows completion event firing

### Test 2: Vaporize and Restore

- Demonstrates element fading back in after vaporization
- Element remains in DOM with opacity transition

### Test 3: Multiple Elements

- Three elements that can be vaporized simultaneously
- Tests directive behavior with multiple instances

## Implementation Details

- **Standalone Angular Component**: Uses modern Angular standalone API
- **Direct Directive Import**: Imports `WsThanosDirective` from `@wolsok/ws-thanos`
- **Configuration**: Provides custom options via `provideWsThanosOptions()`
- **Template References**: Uses `#thanos="thanos"` to access directive instances
- **Event Handling**: Listens to `wsThanosComplete` output event

## Benefits Over Component Testing

Unlike component testing approaches (like Playwright CT with @jscutlery), this approach:

✅ Uses standard `@playwright/test` (no conflicts)
✅ Tests in a real application context
✅ Easier to debug and understand
✅ No experimental dependencies
✅ Follows standard Nx monorepo patterns
✅ Can be manually tested in the browser

## Future Enhancements

Possible additions:

- Visual regression testing with Playwright screenshots
- Performance metrics collection
- Different animation configurations
- Error scenario testing
- Accessibility testing
