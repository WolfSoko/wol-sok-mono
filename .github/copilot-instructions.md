# GitHub Copilot Instructions for wol-sok-mono

This repository is a monorepo of Angular+ experiments and examples, managed with Nx. It showcases science algorithms, shader programming with WebGL, AI examples, and uses Firebase for persistence.

> **📚 Comprehensive Documentation Available**  
> For detailed information, see the `docs/` folder with guides on [Getting Started](../docs/GETTING_STARTED.md), [Architecture](../docs/ARCHITECTURE.md), [Testing](../docs/TESTING.md), [Contributing](../docs/CONTRIBUTING.md), and [Deployment](../docs/DEPLOYMENT.md).

## Repository Overview

- **Tech Stack**: Angular 20+, TypeScript 5.9+, Nx 22+, RxJS 7+, Angular Material, Firebase
- **Key Libraries**: TensorFlow.js, Three.js, p5.js, GPU.js, MathJS
- **Monorepo Manager**: Nx (not Lerna or Turborepo)
- **Testing**: Jest (unit), Playwright (E2E)
- **Code Style**: ESLint + Prettier, 2-space indentation, kebab-case filenames

## Project Structure

```
apps/
  <app-name>/          # Individual applications
    src/               # Source code (components, routes, styles)
    e2e/              # Playwright E2E tests
libs/
  public/            # Shared libraries
  internal/          # Internal libraries
```

Key applications in this monorepo:

- `pacetrainer` - Training pace calculator
- `rollapolla-analog` - Analog-based app
- `fourier-analysis-remote` - Fourier analysis tool
- `angular-examples` - Main examples showcase

## Essential Commands

### Development

```bash
npm ci                                    # Install dependencies
npx nx serve <project>                    # Serve locally (e.g., pacetrainer)
npx nx serve <project> --configuration production  # Production mode
npx nx graph                              # Visualize project dependencies
```

### Building

```bash
npx nx build <project>                    # Build a project
npx nx build <project> --configuration production  # Production build
npx nx affected -t build                  # Build affected projects
```

### Testing

```bash
npx nx test <project>                     # Run unit tests (Jest)
npx nx run <project>:e2e                  # Run E2E tests (Playwright)
npx nx affected -t test                   # Test affected projects
```

### Linting & Formatting

```bash
npm run lint                              # Lint and fix all projects
npx nx lint <project> --fix              # Lint specific project
npx nx affected -t lint                   # Lint affected projects
```

## Coding Standards

### File Naming & Structure

- Use **kebab-case** for all filenames: `training-live-state.component.ts`
- Test files: `*.spec.ts` (colocated with source files)
- E2E tests: in `apps/<app>/e2e/` directory
- Page objects: `e2e/pos/`
- Fixtures: `e2e/fixtures/`

### TypeScript/Angular Guidelines

- Use **strongly typed APIs** - avoid `any` unless absolutely necessary
- Mark class members as `public` or `private` explicitly
- Follow Angular style guide conventions
- Prefer **RxJS** for reactive programming patterns
- Use **Angular Material** components for UI

### Code Style

- **2-space indentation** (enforced by Prettier)
- Run Prettier and ESLint before committing (via Husky pre-commit hooks)
- Follow existing patterns in the codebase

### State Management

- This repo uses **Akita** and **Elf** for state management
- Follow existing state management patterns when working with stores

## Testing Guidelines

### Unit Tests (Jest)

- Keep tests **near the code** in `src/**/*.spec.ts`
- Use descriptive test names: `it('should calculate pace correctly when given valid inputs')`
- Mock external services and Firebase calls
- Keep tests fast and deterministic

### E2E Tests (Playwright)

- Store in `apps/<app>/e2e/`
- Use page objects pattern: `e2e/pos/`
- Store test data in fixtures: `e2e/fixtures/`
- Tests should be independent and idempotent

## Commit Standards

This repository uses **Conventional Commits** with commitlint enforcement.

### Commit Message Format

```
<type>(<scope>): <subject>

Examples:
feat(pacetrainer): add sprint timer feature
fix(rollapolla-analog): handle null chat message
docs(readme): update installation instructions
chore(deps): update angular to v20
test(pacetrainer): add unit tests for pace calculator
```

### Common Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates

### Common Scopes

- Project names: `pacetrainer`, `rollapolla-analog`, `fourier-analysis-remote`, `angular-examples`
- Library names: `ws-thanos`, `shared`
- General: `deps`, `ci`, `build`, `docs`

## Security & Configuration

### Environment Files

- Use `apps/<app>/src/environments/` for app-specific configuration
- **Never commit secrets** - use environment variables or secure vaults
- Review `SECURITY.md` for security guidelines

### Firebase Configuration

- Firebase config files: `firebase.pacetrainer.json`, `firebase.rollapolla-analog.json`
- Use Firebase tools for deployment: `firebase-tools`

## Working with Nx

### Best Practices

- **Always use Nx** to run tasks: `npx nx run`, `npx nx run-many`, `npx nx affected`
- Don't use underlying tools directly (e.g., don't run `jest` directly, use `nx test`)
- Use `npx nx affected` before merging to test only changed code
- Leverage Nx caching for faster builds

### Nx-Specific Commands

```bash
npx nx run-many -t build,test,lint        # Run multiple tasks
npx nx affected -t build,test,lint        # Run tasks on affected projects
npx nx graph                              # Visualize dependency graph
```

## Documentation

- **[Angular Framework Overview](./docs/ANGULAR.md)** - Comprehensive Angular guide
- **[SECURITY.md](../SECURITY.md)** - Security guidelines
- **[AGENTS.md](../AGENTS.md)** - Additional agent instructions

## Special Requirements

### Installation Prerequisites

- `node-gyp` must be properly configured for `npm install`
- See: [node-gyp installation](https://github.com/nodejs/node-gyp#installation)

### Notable Libraries in This Repo

- **@wolsok/thanos**: Custom Angular component that vaporizes HTML elements
  - Published on npm: [@wolsok/thanos](https://www.npmjs.com/package/@wolsok/thanos)
  - See: `libs/public/ws-thanos/README.md`

## Pull Request Guidelines

When submitting PRs:

1. Include appropriate scope and summary in title
2. Add screenshots for UI changes
3. Link related issues
4. Ensure `npm test` and `npm run lint` pass
5. Avoid unrelated refactoring
6. Use `npx nx affected` to verify impact

## Common Patterns in This Repo

### Component Structure

- Components use Angular standalone components where applicable
- Follow Material Design principles with Angular Material
- Use CSS Grid and Flexbox for layouts

### Reactive Programming

- Heavy use of RxJS observables
- Prefer reactive patterns over imperative code
- Use `@ngneat/until-destroy` for subscription management

### WebGL & Shaders

- Custom WebGL shaders stored in Firebase
- Use Three.js for 3D rendering
- p5.js for creative coding visualizations

## When Working on Issues

1. Check if the issue affects a specific app or is repository-wide
2. For app-specific changes, scope commits to that app (e.g., `feat(pacetrainer):`)
3. Run affected tests before and after changes
4. Update documentation if behavior changes
5. Add tests for new functionality

## Troubleshooting

### Build Issues

- Clear Nx cache: `npx nx reset`
- Reinstall dependencies: `rm -rf node_modules package-lock.json && npm ci`
- Check Node version matches `.nvmrc`

### Test Issues

- Ensure Firebase mocks are properly configured for unit tests
- Check Playwright browser binaries are installed: `npx playwright install`

---

## Documentation

For comprehensive information, refer to these guides in the `docs/` folder:

- **[Getting Started Guide](../docs/GETTING_STARTED.md)** - Complete setup instructions, prerequisites, troubleshooting, and IDE configuration
- **[Architecture Overview](../docs/ARCHITECTURE.md)** - Monorepo structure, technology stack, design principles, and development workflow
- **[Testing Guide](../docs/TESTING.md)** - Unit testing (Jest), E2E testing (Playwright), best practices, and common patterns
- **[Contributing Guide](../docs/CONTRIBUTING.md)** - Contribution workflow, code standards, commit conventions, and PR process
- **[Deployment Guide](../docs/DEPLOYMENT.md)** - Firebase, AWS CDK, and GitHub Pages deployment procedures with rollback steps
- **[Angular Framework Overview](../docs/ANGULAR.md)** - Angular patterns, Signals, RxJS, and modern Angular features used in this monorepo

For additional guidelines, see `AGENTS.md` in the repository root.
