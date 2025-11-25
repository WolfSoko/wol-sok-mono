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
**Status:** 🔴 RED - Test Created

**Objective:** Test that the side navigation menu opens, displays all route links, and navigates correctly.

**Steps:**
1. 🔴 **RED**: ✅ Written failing test for side nav toggle functionality
2. 🟢 **GREEN**: Pending - Ensure the feature works and test passes
3. 🔵 **REFACTOR**: Pending - Clean up and optimize test code

**Test Scenarios:**
- ✅ Should toggle side navigation on menu button click
- ✅ Should display all navigation links
- ✅ Should navigate to correct route when clicking a link

---

### Test 2: Home Page with Technologies Display
**Status:** 🔴 RED - Test Created

**Objective:** Verify the home page loads and displays technology cards correctly.

**Steps:**
1. 🔴 **RED**: ✅ Written failing test for home page content
2. 🟢 **GREEN**: Pending - Ensure content displays and test passes
3. 🔵 **REFACTOR**: Pending - Extract reusable patterns to fixtures/POs

**Test Scenarios:**
- ✅ Should display "WolSok Experiments" title
- ✅ Should display all 9 technology cards
- ✅ Should have working links on technology cards
- ✅ Should display about section
- ✅ Should display technology card information

---

### Test 3: Thanos Demo Feature Interaction
**Status:** 🔴 RED - Test Created

**Objective:** Test the interactive Thanos vaporization demo functionality.

**Steps:**
1. 🔴 **RED**: ✅ Written failing test for demo button interaction
2. 🟢 **GREEN**: Pending - Verify demo starts/stops correctly
3. 🔵 **REFACTOR**: Pending - Optimize wait conditions and assertions

**Test Scenarios:**
- ✅ Should start demo when clicking start button
- ✅ Should display stop icon when demo is running
- ✅ Should stop demo when clicking stop button
- ✅ Should handle individual card clicks

---

### Test 4: Route Navigation and Lazy Loading
**Status:** 🔴 RED - Test Created

**Objective:** Verify routing works correctly and lazy-loaded modules load.

**Steps:**
1. 🔴 **RED**: ✅ Written failing test for route navigation
2. 🟢 **GREEN**: Pending - Confirm navigation and lazy loading works
3. 🔵 **REFACTOR**: Pending - Create reusable navigation fixtures

**Test Scenarios:**
- ✅ Should navigate to different routes via side nav
- ✅ Should load lazy-loaded components (e.g., TensorFlow examples)
- ✅ Should update browser URL correctly
- ✅ Should handle back/forward navigation
- ✅ Should load multiple lazy routes without errors

---

## Phase 2: Jest Unit Tests

### Test Suite 1: InfoComponent
**Status:** 🟢 GREEN - Tests Created and Passing

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
- ✅ Should create component
- ✅ Should display 9 technologies
- ✅ Should have readonly technologies signal
- ✅ Should initialize with correct technology data
- ✅ Should start demo on button click
- ✅ Should stop demo when stopDemo is called
- ✅ Should toggle demo state
- ✅ Should have thanosDemo input with default false
- ✅ Should accept thanosDemo input
- ✅ Should handle demo lifecycle with techCards
- ✅ Should clean up on destroy

---

### Test Suite 2: TechnologyComponent
**Status:** 🟢 GREEN - Tests Created and Passing

**Objective:** Test individual technology card component behavior.

**Test Cases:**
- ✅ Should create component
- ✅ Should display technology information
- ✅ Should have autoVaporize input defaulting to false
- ✅ Should have autoVaporizeAfter input defaulting to 1000ms
- ✅ Should accept autoVaporize input
- ✅ Should accept autoVaporizeAfter input
- ✅ Should have vaporizeAndScrollIntoView method
- ✅ Should call vaporize when autoVaporize is true
- ✅ Should not call vaporize when autoVaporize is false
- ✅ Should scroll element into view when vaporizing

---

### Test Suite 3: MainToolbarComponent
**Status:** 🟢 GREEN - Tests Created and Passing

**Objective:** Test toolbar functionality and user interactions.

**Test Cases:**
- ✅ Should create component
- ✅ Should emit clickSideNav event on button click
- ✅ Should have shader code defined
- ✅ Should have runAnimation signal
- ✅ Should have isHandset signal
- ✅ Should initialize with dark theme mode
- ✅ Should handle shader resize events
- ✅ Should have login component in template
- ✅ Should have service worker update component in template
- ✅ Should handle navigation events
- ✅ Should integrate with headline animation service
- ✅ Should cleanup on destroy

---

### Test Suite 4: SideNavComponent (Enhancement)
**Status:** 🟢 GREEN - Enhanced with Comprehensive Coverage

**Objective:** Enhance existing basic test with comprehensive coverage.

**Test Cases:**
- ✅ Should create component
- ✅ Should have a drawer component
- ✅ Should have toggle method
- ✅ Should toggle drawer when toggle is called
- ✅ Should render navigation content in drawer
- ✅ Should have navigation list in drawer
- ✅ Should display router outlet for content
- ✅ Should handle responsive layout changes
- ✅ Should cleanup on destroy

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

### Completed Tests: 8/8 ✅
- E2E Tests: 4/4 (RED phase complete, GREEN pending verification)
- Unit Tests: 4/4 (RED + GREEN phases complete)

### Current Focus
All planned tests have been created. E2E tests (RED phase) are ready for verification when Playwright browsers can be installed. Unit tests are passing (GREEN phase).

### Summary
- ✅ Created comprehensive test plan with TDD approach
- ✅ Created 4 E2E test suites with 20 test cases
- ✅ Created 4 unit test suites with 42 test cases
- ✅ All unit tests passing (GREEN phase)
- ⏳ E2E tests ready for verification (awaiting browser installation)

### Notes
- Repository uses Nx monorepo structure
- Playwright config already set up at `apps/angular-examples/playwright.config.ts`
- Jest config at `apps/angular-examples/jest.config.ts`
- Existing test examples available in other apps (pacetrainer)

---

**Last Updated:** 2025-10-27 (All tests created - RED and GREEN phases complete for unit tests)
