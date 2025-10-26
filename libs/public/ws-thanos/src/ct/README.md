# Playwright Component Testing for WsThanosDirective

This directory contains Playwright Component Tests for the WsThanosDirective. These tests run in a real browser environment (Chromium) to validate directive behavior that requires browser features like `html2canvas`, canvas rendering, and `getComputedStyle`.

## Why Playwright Component Testing?

The directive's vaporization effect uses:
- **html2canvas** to capture DOM elements as canvas
- **Canvas 2D rendering** for particle animations
- **getComputedStyle** for opacity transitions
- **requestAnimationFrame** for smooth animations

These features are not properly simulated in jsdom (used by Jest), which is why we use Playwright Component Testing for real browser validation.

## Running the Tests

### Run all component tests (headless):
```bash
npx nx run ws-thanos:ct
```

### Run with UI (headed browser):
```bash
npx nx run ws-thanos:ct -- --headed
```

### Run with Playwright UI mode (recommended for debugging):
```bash
npx nx run ws-thanos:ct -- --ui
```

### Run specific test file:
```bash
npx nx run ws-thanos:ct -- ws-thanos.directive.ct.spec.ts
```

### Debug mode (slow motion):
```bash
npx nx run ws-thanos:ct -- --headed --slow-mo=1000
```

## Test Structure

- **`ws-thanos.directive.ct.spec.ts`** - Main component tests for the directive
  - Tests directive creation and rendering
  - Tests vaporization animation with `removeElem=false` (fade back)
  - Tests vaporization with `removeElem=true` (element removal)
  - Tests canvas overlay creation during animation

- **`sanity-check.ct.spec.ts`** - Simple sanity check to verify Playwright CT is working

## Configuration

The Playwright Component Testing configuration is in `playwright-ct.config.ts`:
- Uses `@jscutlery/playwright-ct-angular` for Angular support
- Configured for Chromium browser
- Test files match pattern: `**/*.ct.spec.ts`
- Animation duration set to 500ms for faster tests

## Notes

- The directive is configured with a short animation duration (500ms) in tests for speed
- Tests wait for animations to complete before making assertions
- Canvas overlays are created dynamically during vaporization and cleaned up afterward
- The `removeElem` parameter controls whether elements are removed or faded back after animation

## Troubleshooting

### Tests not running?
- Ensure Chromium browser is installed: `npx playwright install chromium`
- Check that test files end with `.ct.spec.ts`

### Playwright version conflicts?
- The `@jscutlery/playwright-ct-angular` package bundles its own Playwright
- Jest tests ignore `.ct.spec.ts` files to avoid conflicts

### Animation timing issues?
- Tests wait for animation completion + buffer time
- Adjust timeouts in test files if needed for slower environments
