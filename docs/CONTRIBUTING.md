# Contributing Guide

Thank you for your interest in contributing to wol-sok-mono! This guide will help you get started with contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and collaborative environment. We expect:

- **Respectful communication**: Be kind and constructive in discussions
- **Inclusive language**: Avoid discriminatory or offensive language
- **Focus on the work**: Keep discussions focused on the code and project
- **Help others**: Support fellow contributors

## Getting Started

### Prerequisites

Before contributing, ensure you have:

1. **Completed setup**: Follow the [Getting Started Guide](./GETTING_STARTED.md)
2. **Forked the repository**: Create your own fork on GitHub
3. **Cloned your fork**: `git clone https://github.com/YOUR_USERNAME/wol-sok-mono.git`
4. **Added upstream remote**: `git remote add upstream https://github.com/WolfSoko/wol-sok-mono.git`

### Understanding the Project

Read these documents to understand the project:

- [Architecture Overview](./ARCHITECTURE.md) - Project structure and design
- [Testing Guide](./TESTING.md) - Testing practices
- [Angular Guide](./ANGULAR.md) - Angular patterns used

## Development Workflow

### 1. Sync Your Fork

Before starting work, sync with the upstream repository:

```bash
git checkout main
git fetch upstream
git merge upstream/main
git push origin main
```

### 2. Create a Feature Branch

Create a branch with a descriptive name:

```bash
# Format: type/short-description
git checkout -b feat/add-pace-calculator
git checkout -b fix/race-condition-in-timer
git checkout -b docs/update-testing-guide
```

Branch naming conventions:

- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or updates
- `chore/` - Maintenance tasks

### 3. Make Your Changes

Follow these guidelines:

- **Keep changes focused**: One feature/fix per PR
- **Write clean code**: Follow the [Code Standards](#code-standards)
- **Add tests**: Every feature needs tests
- **Update docs**: Document new features or changed behavior
- **Test locally**: Ensure all tests pass before committing

### 4. Commit Your Changes

Follow [Conventional Commits](#commit-guidelines):

```bash
git add .
git commit -m "feat(pacetrainer): add split time calculator"
```

### 5. Push to Your Fork

```bash
git push origin feat/add-pace-calculator
```

### 6. Create a Pull Request

1. Go to the [repository on GitHub](https://github.com/WolfSoko/wol-sok-mono)
2. Click "Pull requests" → "New pull request"
3. Click "compare across forks"
4. Select your fork and branch
5. Fill in the PR template
6. Submit the pull request

## Code Standards

### TypeScript

- **Use TypeScript**: All code should be strongly typed
- **Explicit types**: Avoid `any`, use proper types or interfaces
- **Strict mode**: Follow `tsconfig.json` strict settings

```typescript
// ✓ Good
function calculatePace(distance: number, time: number): number {
  return time / distance;
}

// ✗ Bad
function calculatePace(distance: any, time: any): any {
  return time / distance;
}
```

### Angular

- **Standalone components**: Use standalone API (no NgModules)
- **OnPush change detection**: Use `ChangeDetectionStrategy.OnPush`
- **Signals for state**: Prefer Signals over traditional state management
- **Smart/Dumb components**: Separate container and presentational components

```typescript
// ✓ Good
@Component({
  selector: 'app-pace-display',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaceDisplayComponent {
  pace = input.required<number>();
  formattedPace = computed(() => this.formatPace(this.pace()));
}
```

### File Naming

- **Components**: `kebab-case.component.ts`
- **Services**: `kebab-case.service.ts`
- **Directives**: `kebab-case.directive.ts`
- **Pipes**: `kebab-case.pipe.ts`
- **Tests**: `*.spec.ts`

### Code Organization

```typescript
// Import order:
// 1. Angular imports
import { Component, Input } from '@angular/core';

// 2. Third-party imports
import { Observable } from 'rxjs';

// 3. Local imports
import { UserService } from './user.service';
```

### Style Guidelines

- **2-space indentation**: Configure your editor
- **Single quotes**: For strings (enforced by Prettier)
- **Semicolons**: Always use semicolons
- **No trailing whitespace**: Remove trailing spaces
- **Max line length**: 120 characters (soft limit)

### SCSS/CSS

- **Use SCSS**: Preferred over plain CSS
- **BEM naming**: For custom classes (when not using Angular Material)
- **Component-scoped styles**: Keep styles in component files
- **CSS Grid/Flexbox**: For layouts

```scss
// ✓ Good - component-scoped, organized
:host {
  display: block;
  padding: 1rem;
}

.pace-display {
  display: flex;
  gap: 0.5rem;

  &__value {
    font-weight: bold;
  }

  &__unit {
    color: var(--text-secondary);
  }
}
```

### Linting and Formatting

Code is automatically linted and formatted:

- **ESLint**: Linting JavaScript/TypeScript
- **Prettier**: Code formatting
- **Husky**: Pre-commit hooks
- **lint-staged**: Lint only changed files

Run manually:

```bash
# Lint and auto-fix
npx nx lint <project> --fix

# Format with Prettier
npm run format

# Check all (runs in CI)
npm run lint
```

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) enforced by commitlint.

### Commit Message Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic change)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks
- **perf**: Performance improvements
- **ci**: CI/CD changes
- **build**: Build system changes

### Scopes

Use the project name or feature area:

- `pacetrainer`
- `angular-examples`
- `ws-thanos`
- `testing`
- `deps` (for dependency updates)

### Examples

```bash
feat(pacetrainer): add split time calculator
fix(angular-examples): resolve race condition in timer
docs(testing): update E2E testing guide
refactor(utils): simplify math calculation functions
test(pacetrainer): add tests for pace calculator
chore(deps): update Angular to v20.3.7
```

### Commit Message Rules

- **Lowercase subject**: Don't capitalize the first letter
- **No period**: Don't end with a period
- **Imperative mood**: "add" not "added" or "adds"
- **Keep it short**: 50-72 characters for subject
- **Body optional**: Add details if needed

### Multi-line Commits

```bash
git commit -m "feat(pacetrainer): add advanced pace calculator

- Support multiple distance units
- Calculate split times
- Add pace comparison
- Include elevation adjustment

Closes #123"
```

## Pull Request Process

### PR Template

Fill in all sections of the PR template:

1. **Description**: What does this PR do?
2. **Type of Change**: Feature, bug fix, documentation, etc.
3. **Related Issues**: Link to issues this PR addresses
4. **Screenshots**: For UI changes
5. **Checklist**: Complete all items

### PR Checklist

Before submitting, ensure:

- [ ] Code follows the style guide
- [ ] Self-reviewed the code
- [ ] Added/updated tests
- [ ] All tests pass locally
- [ ] Linting passes
- [ ] Added/updated documentation
- [ ] No console errors or warnings
- [ ] Tested in multiple browsers (for UI changes)

### CI Checks

Your PR will automatically run:

- **Linting**: ESLint checks
- **Type checking**: TypeScript compilation
- **Tests**: Unit and E2E tests
- **Build**: Production build
- **Security**: CodeQL scanning (if applicable)
- **Coverage**: Code coverage reporting

All checks must pass before merging.

### Code Review

Your PR will be reviewed by maintainers. Expect:

- **Constructive feedback**: Suggestions for improvement
- **Questions**: Clarification on design decisions
- **Requested changes**: Address before approval
- **Approval**: When ready, PR will be approved

Be responsive to feedback and ask questions if unclear.

### Updating Your PR

If changes are requested:

```bash
# Make changes locally
# ...

# Commit changes
git add .
git commit -m "refactor: address review comments"

# Push to update PR
git push origin feat/add-pace-calculator
```

### Squashing Commits

Maintainers may ask you to squash commits for a cleaner history:

```bash
# Interactive rebase to squash commits
git rebase -i HEAD~3  # Squash last 3 commits

# Force push (only on feature branches!)
git push origin feat/add-pace-calculator --force
```

## Testing Requirements

Every contribution should include appropriate tests.

### Unit Tests Required For

- New components
- New services
- New utilities
- Bug fixes (regression tests)
- Business logic changes

### E2E Tests Required For

- New user-facing features
- Critical user flows
- Integration between features

### Test Coverage

- Aim for **70%+ coverage** for new code
- Don't reduce existing coverage
- Coverage is checked in CI

### Running Tests

```bash
# Unit tests
npx nx test <project>

# E2E tests
npx nx run <project>:e2e

# All tests
npx nx run-many -t test

# With coverage
npx nx test <project> --coverage
```

See [Testing Guide](./TESTING.md) for detailed testing practices.

## Documentation

### Documentation Requirements

Update documentation when you:

- Add new features
- Change existing behavior
- Add new libraries or tools
- Change APIs
- Fix bugs (if it affects usage)

### Documentation Types

1. **Code comments**: For complex logic
2. **JSDoc**: For public APIs
3. **README files**: For libraries and apps
4. **Docs folder**: For guides and references
5. **CHANGELOG**: Automatically generated from commits

### Writing Good Documentation

- **Clear and concise**: Get to the point
- **Examples**: Show how to use features
- **Up-to-date**: Update when code changes
- **Accessible**: Use simple language
- **Structured**: Use headings and lists

## Types of Contributions

### Bug Reports

Report bugs by creating an issue with:

- Clear title and description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/videos if applicable
- Environment details (browser, OS, versions)

### Feature Requests

Suggest features by creating an issue with:

- Clear use case
- Proposed solution
- Alternative solutions considered
- Why it benefits the project

### Code Contributions

Follow the workflow above for:

- New features
- Bug fixes
- Performance improvements
- Refactoring

### Documentation Improvements

Help improve documentation:

- Fix typos
- Clarify confusing sections
- Add examples
- Update outdated content
- Translate documentation

### Code Review

Help review pull requests:

- Check code quality
- Test functionality
- Suggest improvements
- Verify tests

## Getting Help

### Resources

- **Documentation**: Check the `docs/` folder
- **Issues**: Search existing issues
- **Discussions**: Ask questions in GitHub Discussions
- **Code**: Look at existing implementations

### Communication

- **Be patient**: Maintainers are often busy
- **Be specific**: Provide details in questions
- **Be respectful**: Everyone is learning
- **Search first**: Your question may be answered already

## Recognition

Contributors are recognized in:

- **Contributors section**: README.md
- **Commit history**: Git log
- **Release notes**: CHANGELOG.md
- **GitHub insights**: Contributor graph

Thank you for contributing! 🎉

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

If you have questions about contributing:

1. Check this guide and other documentation
2. Search existing issues and discussions
3. Create a new discussion or issue
4. Reach out to maintainers

We're here to help! Welcome to the project! 🚀
