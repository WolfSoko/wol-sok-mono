[![.github/workflows/ci.yml](https://github.com/WolfSoko/wol-sok-mono/actions/workflows/ci.yml/badge.svg)](https://github.com/WolfSoko/wol-sok-mono/actions/workflows/ci.yml)
![renovate](https://img.shields.io/badge/maintained%20with-renovate-blue?logo=renovatebot)
[![codecov](https://codecov.io/github/WolfSoko/wol-sok-mono/branch/main/graph/badge.svg?token=SYKFAX478R)](https://codecov.io/github/WolfSoko/wol-sok-mono)

wol-sok-mono repo

# Wild experiments and examples implemented in Angular+

A monorepo of Angular applications showcasing interactive visualizations, scientific algorithms, and creative coding experiments.

## About This Project

This repository contains multiple Angular applications demonstrating various topics including:

- **Scientific Algorithms**: Poisson distribution, Fourier analysis, reaction-diffusion systems
- **Graphics & Visualization**: WebGL shaders, Three.js 3D graphics, p5.js creative coding
- **Machine Learning**: Neural networks and TensorFlow.js examples
- **Performance**: WebAssembly integrations and GPU-accelerated calculations

The project emphasizes clean code architecture following the Angular style guide and Nx monorepo best practices, with extensive use of RxJS for reactive programming and Angular Material for consistent UI components.

## Documentation

- **[Getting Started Guide](./docs/GETTING_STARTED.md)** - Setup instructions and first steps
- **[Architecture Overview](./docs/ARCHITECTURE.md)** - Repository structure and design principles
- **[Testing Guide](./docs/TESTING.md)** - Testing practices and guidelines
- **[E2E Testing with Playwright](./docs/E2E_TESTING.md)** - Guide to end-to-end testing using Playwright
- **[Angular Framework Overview](./docs/ANGULAR.md)** - Angular patterns used in this monorepo
- **[Documentation Improvements](./docs/IMPROVEMENTS.md)** - Identified documentation issues and fixes

## Quick Start

```bash
# Clone the repository
git clone https://github.com/WolfSoko/wol-sok-mono.git
cd wol-sok-mono

# Install dependencies
npm ci

# Start development server
npx nx serve angular-examples
```

Visit http://localhost:4200 to see the examples.

For detailed setup instructions, see the [Getting Started Guide](./docs/GETTING_STARTED.md).

## ws-thanos

A special angular-component is extracted from these experiments called `ws-thanos`. It vaporizes your html Elements into
tiny atoms.
[@wolsok/thanos on npm](https://www.npmjs.com/package/@wolsok/thanos)

Readme under: [README.md](./libs/public/ws-thanos/README.md)

A running version can be found on GitHub pages: https://angularexamples.wolsok.de/

## Technology Stack

This monorepo leverages modern web technologies:

- **Framework**: Angular 20 with Signals, Standalone Components, and Zoneless Change Detection
- **Meta-framework**: Analog.js for SSR and file-based routing
- **Build Tools**: Nx 22, Vite, Webpack with Module Federation
- **State Management**: Angular Signals, RxJS, Akita
- **UI**: Angular Material, Angular CDK
- **Graphics**: Three.js, p5.js, WebGL
- **Testing**: Jest, Playwright, Vitest
- **Backend**: Firebase, tRPC, AWS CDK
- **Scientific**: TensorFlow.js, math.js, GPU.js, WebAssembly

## Project Structure

```
apps/          # Deployable applications
  ├── angular-examples/        # Main showcase app
  ├── pacetrainer/            # Pace training app
  ├── rollapolla-analog/      # Analog.js demo
  └── *-remote/               # Module Federation remotes

libs/          # Reusable libraries
  ├── features/               # Domain features
  ├── shared/                 # Shared logic
  ├── utils/                  # Utilities
  └── public/                 # Published packages
```

See [Architecture Overview](./docs/ARCHITECTURE.md) for detailed structure.

## npm install

To run `npm install` you need to make sure `node-gyp` compilation process is working. See here: [node-gyp installation](https://github.com/nodejs/node-gyp#installation)

## Contributors

[![contributors](https://contrib.rocks/image?repo=WolfSoko/wol-sok-mono)](https://github.com/WolfSoko/wol-sok-mono/graphs/contributors)
