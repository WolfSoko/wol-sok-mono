# Test Coverage Plan for angular-examples App

## Overview
This plan follows Test-Driven Development (TDD) methodology using the Red-Green-Refactor cycle for both E2E and unit tests.

## Phase 1: E2E Tests with Playwright

### Test Infrastructure Setup
- [x] Understand existing test structure and patterns
- [x] Create fixtures directory structure
- [x] Set up base fixtures (logs, page hydration)
- [x] Create page objects (POs) for key components

### Test 1: Navigation Menu Functionality
**Status:** 🔴 RED - Test Created (Awaiting Verification)

**Objective:** Test that the side navigation menu opens, displays all route links, and navigates correctly.

**Steps:**
1. 🔴 **RED**: Write failing test for side nav toggle functionality
2. 🟢 **GREEN**: Ensure the feature works and test passes
3. 🔵 **REFACTOR**: Clean up and optimize test code

**Test Scenarios:**
- Should toggle side navigation on menu button click
- Should display all navigation links
- Should navigate to correct route when clicking a link

---

### Test 2: Home Page with Technologies Display
**Status:** 🔴 Not Started

**Objective:** Verify the home page loads and displays technology cards correctly.

**Steps:**
1. 🔴 **RED**: Write failing test for home page content
2. 🟢 **GREEN**: Ensure content displays and test passes
3. 🔵 **REFACTOR**: Extract reusable patterns to fixtures/POs

**Test Scenarios:**
- Should display "WolSok Experiments" title
- Should display all 9 technology cards
- Should have working links on technology cards

---

### Test 3: Thanos Demo Feature Interaction
**Status:** 🔴 Not Started

**Objective:** Test the interactive Thanos vaporization demo functionality.

**Steps:**
1. 🔴 **RED**: Write failing test for demo button interaction
2. 🟢 **GREEN**: Verify demo starts/stops correctly
3. 🔵 **REFACTOR**: Optimize wait conditions and assertions

**Test Scenarios:**
- Should start demo when clicking start button
- Should display stop icon when demo is running
- Should stop demo when clicking stop button
- Should vaporize technology cards sequentially

---

### Test 4: Route Navigation and Lazy Loading
**Status:** 🔴 Not Started

**Objective:** Verify routing works correctly and lazy-loaded modules load.

**Steps:**
1. 🔴 **RED**: Write failing test for route navigation
2. 🟢 **GREEN**: Confirm navigation and lazy loading works
3. 🔵 **REFACTOR**: Create reusable navigation fixtures

**Test Scenarios:**
- Should navigate to different routes via side nav
- Should load lazy-loaded components (e.g., TensorFlow examples)
- Should update browser URL correctly
- Should handle back/forward navigation

---

## Phase 2: Jest Unit Tests

### Test Suite 1: InfoComponent
**Status:** 🔴 Not Started

**Objective:** Comprehensive unit tests for the home/info component.

**Test Structure:**
```typescript
describe('InfoComponent', () => {
  it('should do X', () => {
    // Given: Setup initial state
    // When: Perform action
    // Then: Verify outcome
  });
});
```

**Test Cases:**
- Should create component
- Should display 9 technologies
- Should start demo on button click
- Should stop demo on button click
- Should handle demo lifecycle correctly

---

### Test Suite 2: TechnologyComponent
**Status:** 🔴 Not Started

**Objective:** Test individual technology card component behavior.

**Test Cases:**
- Should display technology information
- Should handle click events
- Should vaporize on command
- Should navigate to external link

---

### Test Suite 3: MainToolbarComponent
**Status:** 🔴 Not Started

**Objective:** Test toolbar functionality and user interactions.

**Test Cases:**
- Should display app title
- Should emit click events for side nav toggle
- Should display service worker update notifications
- Should handle login/logout functionality

---

### Test Suite 4: SideNavComponent (Enhancement)
**Status:** 🔴 Not Started

**Objective:** Enhance existing basic test with comprehensive coverage.

**Test Cases:**
- Should toggle drawer open/close
- Should display navigation links from router config
- Should highlight active route
- Should be responsive to screen size changes

---

## Testing Standards

### Playwright E2E Tests
- ✅ Use fixtures pattern for test setup
- ✅ Create page objects (POs) for reusable element access
- ✅ Store test data in fixtures directory
- ✅ Keep tests independent and idempotent
- ✅ Use descriptive test names: `test('should do X when Y')`
- ✅ File naming: `kebab-case.spec.ts`

### Jest Unit Tests
- ✅ Use Given/When/Then comments for clarity
- ✅ Test file naming: `component-name.spec.ts` (colocated)
- ✅ Use `it('should...')` format for test descriptions
- ✅ Mock external dependencies (Firebase, services)
- ✅ Keep tests fast and deterministic
- ✅ Use TestBed for Angular component testing

### TDD Workflow
1. **🔴 RED**: Write a failing test first
2. **🟢 GREEN**: Write minimal code to make it pass
3. **🔵 REFACTOR**: Improve code quality without changing behavior
4. **✅ COMMIT**: Commit after each successful Red-Green-Refactor cycle
5. **📝 UPDATE**: Update this plan with status and learnings

---

## Progress Tracking

### Completed Tests: 0/8
- E2E Tests: 0/4
- Unit Tests: 0/4

### Current Focus
Starting with E2E Test 1: Navigation Menu Functionality

### Notes
- Repository uses Nx monorepo structure
- Playwright config already set up at `apps/angular-examples/playwright.config.ts`
- Jest config at `apps/angular-examples/jest.config.ts`
- Existing test examples available in other apps (pacetrainer)

---

**Last Updated:** 2025-10-27 (Initial creation)
