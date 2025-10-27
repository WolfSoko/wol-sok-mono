# Architecture Overview

This document provides a high-level overview of the wol-sok-mono repository architecture, structure, and design principles.

## Table of Contents

- [Repository Structure](#repository-structure)
- [Applications](#applications)
- [Libraries](#libraries)
- [Technology Stack](#technology-stack)
- [Architecture Principles](#architecture-principles)
- [Development Workflow](#development-workflow)

## Repository Structure

This is an **Nx monorepo** containing multiple Angular applications and shared libraries. The repository follows a modular architecture where common functionality is extracted into reusable libraries.

```
wol-sok-mono/
├── apps/                    # Application projects
│   ├── pacetrainer/        # Pace training application
│   ├── rollapolla-analog/  # Analog.js-based application
│   ├── angular-examples/   # Main examples showcase
│   ├── fourier-analysis-remote/
│   ├── bacteria-game-remote/
│   └── shader-examples-remote/
│
├── libs/                    # Shared libraries
│   ├── features/           # Feature modules
│   │   ├── api/            # API integrations
│   │   └── lazy/           # Lazily loaded features
│   ├── shared/             # Shared business logic
│   ├── utils/              # Utility libraries
│   ├── public/             # Publicly published packages
│   ├── ui-kit/             # UI components
│   ├── fib-wasm/           # WebAssembly modules
│   └── test-helper/        # Testing utilities
│
├── docs/                    # Documentation
├── tools/                   # Build and deployment scripts
└── .github/                 # GitHub workflows and configs
```

### Key Directories

- **`apps/`**: Contains deployable applications, each with its own build configuration
- **`libs/`**: Contains reusable libraries organized by scope:
  - `features/`: Domain-specific features and modules
  - `shared/`: Cross-cutting concerns and business logic
  - `utils/`: Pure utility functions and helpers
  - `public/`: Libraries published to npm (e.g., @wolsok/thanos)
  - `ui-kit/`: Reusable UI components
- **`tools/`**: Node.js scripts for automation, deployment, and utilities
- **`.github/`**: CI/CD pipelines, workflows, and GitHub configuration

## Applications

### Production Applications

#### 1. **angular-examples** (Main Application)

- **Purpose**: Showcase of Angular features, algorithms, and visualizations
- **Features**:
  - Interactive algorithm demonstrations
  - WebGL shader examples
  - Neural network visualizations
  - Scientific simulations
- **Build**: Webpack-based with Module Federation
- **Deployment**: GitHub Pages and S3
- **Tech**: Angular 20, Angular Material, Three.js, p5.js

#### 2. **pacetrainer**

- **Purpose**: Training pace calculator and workout planner
- **Features**: Pace calculations, training plans, workout tracking
- **Build**: Vite-based (via Analog.js)
- **Deployment**: Firebase Hosting
- **Tech**: Angular 20, Analog.js, Angular Material

#### 3. **rollapolla-analog**

- **Purpose**: Experimental application using Analog.js
- **Build**: Vite-based with SSR support
- **Deployment**: Firebase Hosting
- **Tech**: Angular 20, Analog.js, Server-Side Rendering

### Remote Applications (Module Federation)

These applications are loaded as remote modules into the main application:

- **fourier-analysis-remote**: Fourier transform visualizations
- **bacteria-game-remote**: Reaction-diffusion simulation
- **shader-examples-remote**: WebGL shader playground

### CDK Applications

CDK (Cloud Development Kit) applications provide infrastructure as code:

- `angular-examples-cdk`: AWS infrastructure for angular-examples
- `bacteria-game-remote-cdk`: AWS infrastructure for bacteria-game
- `fourier-analysis-remote-cdk`: AWS infrastructure for fourier-analysis
- `shader-examples-remote-cdk`: AWS infrastructure for shader-examples

## Libraries

### Features (`libs/features/`)

Domain-specific functionality:

- **`api/auth`**: Authentication services and guards
- **`lazy/neural-networks`**: Neural network implementations and demos
- **`lazy/poisson`**: Poisson distribution visualization
- **`lazy/tensorflow-examples`**: TensorFlow.js examples
- **`lazy/wasm-test`**: WebAssembly integration examples
- **`lazy/some-gpu-calculation`**: GPU.js calculations

### Shared (`libs/shared/`)

Cross-cutting concerns:

- **`data-access`**: Data fetching and state management
- **`ws-gl`**: WebGL utilities and helpers
- **`headline-animation`**: Reusable animation components

### Utils (`libs/utils/`)

Pure utility libraries:

- **`decorators`**: TypeScript decorators
- **`operators`**: RxJS custom operators
- **`math`**: Mathematical utilities
- **`gpu-calc`**: GPU calculation utilities
- **`measure-fps`**: Performance measurement

### Public (`libs/public/`)

Published npm packages:

- **`ws-thanos`**: [@wolsok/thanos](https://www.npmjs.com/package/@wolsok/thanos) - DOM element vaporization directive
- **`spa-cdk-stack`**: AWS CDK constructs for SPA deployment

### Other Libraries

- **`ui-kit`**: Shared UI components
- **`fib-wasm`**: WebAssembly Fibonacci implementation
- **`fib-wasm-api`**: API for fib-wasm
- **`test-helper`**: Testing utilities and mocks

## Technology Stack

### Frontend Framework

- **Angular 20.3.7**: Modern standalone components, Signals API
- **Analog.js 1.22.1**: Meta-framework for Angular with file-based routing and Vite
- **TypeScript 5.9.3**: Type-safe development

### State Management

- **Angular Signals**: Reactive state primitives
- **RxJS 7.8.2**: Reactive programming
- **Akita 8.0.1**: State management library
- **Elf**: Alternative lightweight state management

### UI Components

- **Angular Material 20.2.10**: Material Design components
- **Angular CDK**: Component Development Kit
- **FontAwesome**: Icon library

### Build Tools

- **Nx 22.0.1**: Monorepo orchestration and caching
- **Vite 7.1.9**: Fast build tool (for Analog.js apps)
- **Webpack 5**: Build tool (for angular-examples)
- **esbuild**: Fast JavaScript bundler

### Testing

- **Jest 30.2.0**: Unit testing
- **Playwright 1.56.1**: End-to-end testing
- **Vitest 4.0.3**: Vite-native testing

### Graphics & Visualization

- **Three.js 0.180.0**: 3D graphics library
- **p5.js 2.0.5**: Creative coding library
- **WebGL**: Custom shader programming
- **Vega/Vega-Lite**: Declarative visualizations

### Scientific Computing

- **TensorFlow.js 4.22.0**: Machine learning
- **math.js 15.0.0**: Advanced mathematics
- **GPU.js 2.16.0**: GPU-accelerated computing

### Backend & Deployment

- **Firebase**: Hosting, authentication, database
- **AWS CDK 2.1031.0**: Infrastructure as code
- **Module Federation**: Micro-frontend architecture
- **tRPC**: Type-safe API layer

### Code Quality

- **ESLint 9.28.0**: Linting
- **Prettier 3.6.2**: Code formatting
- **Husky 9.1.7**: Git hooks
- **lint-staged 16.2.6**: Pre-commit linting
- **Commitlint**: Conventional commit enforcement

## Architecture Principles

### 1. Monorepo Structure

- **Single source of truth**: All code in one repository
- **Shared dependencies**: Common versions across projects
- **Nx caching**: Incremental builds and tests
- **Code sharing**: Reusable libraries reduce duplication

### 2. Module Organization

```
apps/       → User-facing applications (deployable)
libs/       → Shared libraries (not deployable)
  features/ → Business features (domain logic)
  shared/   → Cross-cutting concerns
  utils/    → Pure utilities (no dependencies)
  public/   → Published packages
```

### 3. Dependency Rules

- **Apps** can depend on **features**, **shared**, **utils**, and **ui-kit**
- **Features** can depend on **shared**, **utils**, and **ui-kit**
- **Shared** can depend on **utils**
- **Utils** should have minimal/no dependencies (pure functions)

### 4. Component Architecture

- **Standalone components**: No NgModules (modern Angular)
- **OnPush change detection**: Performance optimization
- **Smart/Container vs Presentational**: Clear separation of concerns
- **Component-scoped styles**: Encapsulation

### 5. State Management Strategy

- **Signals**: Local component state and reactive computations
- **RxJS**: Async operations and complex data flows
- **Akita/Elf**: Application-wide state stores
- **Services**: Stateful business logic

### 6. Testing Strategy

- **Unit tests**: Colocated with source (`.spec.ts`)
- **E2E tests**: In `apps/<app>/e2e` directory
- **Test coverage**: Tracked with Codecov
- **Mock external dependencies**: Fast, reliable tests

### 7. Build Strategy

- **Incremental builds**: Nx computational caching
- **Parallel execution**: Multiple tasks simultaneously
- **Module Federation**: Runtime code sharing between apps
- **Tree shaking**: Eliminate unused code

## Development Workflow

### 1. Local Development

```bash
# Install dependencies
npm ci

# Serve an application
npx nx serve pacetrainer

# Build an application
npx nx build angular-examples --configuration production

# Run tests
npx nx test pacetrainer
npx nx run pacetrainer:e2e

# Lint code
npx nx lint pacetrainer --fix
```

### 2. Monorepo Commands

```bash
# Visualize project dependencies
npx nx graph

# Run affected tasks (only changed projects)
npx nx affected -t build,test,lint

# Run task across all projects
npx nx run-many -t test
```

### 3. Code Generation

```bash
# Generate new library
npx nx g @nx/angular:library my-lib

# Generate new component
npx nx g @nx/angular:component my-component --project=my-lib
```

### 4. CI/CD Pipeline

1. **Pull Request**: Runs affected tests, lints, and builds
2. **Main Branch**: Full build, test, deploy to staging
3. **Release**: Version bump, changelog, deploy to production

### 5. Deployment Targets

- **GitHub Pages**: angular-examples static site
- **Firebase Hosting**: pacetrainer, rollapolla-analog
- **AWS CloudFront + S3**: Remote applications (via CDK)

## Design Patterns

### 1. Reactive Patterns

- **Observable streams**: RxJS for async data
- **Signal-based reactivity**: Angular Signals for synchronous state
- **Effects**: Side effects triggered by signal changes

### 2. Micro-Frontend Pattern

- **Module Federation**: Runtime integration of remote apps
- **Independent deployment**: Each remote can deploy separately
- **Shared dependencies**: Common libraries loaded once

### 3. Lazy Loading

- **Route-based**: Load features on navigation
- **Library-based**: Dynamic imports for heavy libraries
- **Component-based**: Load components on demand

### 4. Service Layer

- **Business logic**: Encapsulated in services
- **Dependency injection**: Angular DI system
- **State management**: Akita/Elf stores

## Performance Considerations

1. **OnPush change detection**: Minimize unnecessary checks
2. **Lazy loading**: Reduce initial bundle size
3. **Nx caching**: Speed up builds and tests
4. **Tree shaking**: Remove unused code
5. **WebWorkers**: Offload heavy computations
6. **WebAssembly**: Performance-critical algorithms

## Security Considerations

1. **No secrets in code**: Use environment variables
2. **Firebase security rules**: Protect backend data
3. **Content Security Policy**: XSS protection
4. **Dependency scanning**: Renovate bot for updates
5. **Code scanning**: GitHub security scanning

## Future Directions

- Expand Analog.js usage for SSR benefits
- More WebAssembly integrations
- Enhanced visualizations
- Additional published libraries
- Improved micro-frontend architecture

## Additional Resources

- [Getting Started Guide](./GETTING_STARTED.md)
- [Testing Guide](./TESTING.md)
- [Angular Framework Overview](./ANGULAR.md)
- [Contributing Guide](./CONTRIBUTING.md)
- [Deployment Guide](./DEPLOYMENT.md)

## References

- [Nx Documentation](https://nx.dev)
- [Angular Documentation](https://angular.dev)
- [Analog.js Documentation](https://analogjs.org)
- [Firebase Documentation](https://firebase.google.com/docs)
