[![.github/workflows/ci.yml](https://github.com/WolfSoko/wol-sok-mono/actions/workflows/ci.yml/badge.svg)](https://github.com/WolfSoko/wol-sok-mono/actions/workflows/ci.yml)
![renovate](https://img.shields.io/badge/maintained%20with-renovate-blue?logo=renovatebot)
[![codecov](https://codecov.io/github/WolfSoko/wol-sok-mono/branch/main/graph/badge.svg?token=SYKFAX478R)](https://codecov.io/github/WolfSoko/wol-sok-mono)
[![Get it on Google Play](https://img.shields.io/badge/Google_Play-Bacteria_Wars-414141?logo=googleplay&logoColor=white)](https://play.google.com/store/apps/details?id=de.wolsok.bacteriawars)
[![@wolsok/thanos on npm](https://img.shields.io/npm/v/@wolsok/thanos?logo=npm&label=%40wolsok%2Fthanos)](https://www.npmjs.com/package/@wolsok/thanos)
[![@wolsok/nx-aws-cdk-v2 on npm](https://img.shields.io/npm/v/@wolsok/nx-aws-cdk-v2?logo=npm&label=%40wolsok%2Fnx-aws-cdk-v2)](https://www.npmjs.com/package/@wolsok/nx-aws-cdk-v2)

wol-sok-mono repo

# Wild experiments and examples implemented in Angular+

A monorepo of Angular applications showcasing interactive visualizations, scientific algorithms, and creative coding experiments.

**Modern Angular Stack:**

- ⚡ **Zoneless Change Detection** - All apps use zoneless mode for better performance
- 🎯 **Signals** - Reactive state management with Angular signals
- 🔀 **Modern Control Flow** - @if, @for, @switch syntax throughout
- 📦 **Standalone Components** - No NgModules, pure standalone architecture

## About This Project

This repository contains multiple Angular applications demonstrating various topics including:

- **Scientific Algorithms**: Poisson distribution, Fourier analysis, reaction-diffusion systems
- **Graphics & Visualization**: WebGL shaders, Three.js 3D graphics, p5.js creative coding
- **Machine Learning**: Neural networks and TensorFlow.js examples
- **Performance**: WebAssembly integrations and GPU-accelerated calculations

The project emphasizes clean code architecture following the Angular style guide and Nx monorepo best practices, with extensive use of RxJS for reactive programming and Angular Material for consistent UI components. **All applications are built with zoneless change detection** for optimal performance.

## Live Apps

| App                           | Link                                                                                | Status                                                                                                                                                                                          | What it is                                                                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Portfolio**                 | [wolsok.de](https://wolsok.de/)                                                     | [![Portfolio](https://img.shields.io/website?url=https://wolsok.de/&label=status&up_message=online&down_message=offline)](https://wolsok.de/)                                                   | Index of all the projects, prerendered Angular ([`portfolio`](./apps/portfolio))                                                                           |
| **Angular Examples**          | [angularexamples.wolsok.de](https://angularexamples.wolsok.de/)                     | [![Angular Examples](https://img.shields.io/website?url=https://angularexamples.wolsok.de/&label=status&up_message=online&down_message=offline)](https://angularexamples.wolsok.de/)            | The main showcase: shader, Fourier, neural-network, reaction-diffusion and more experiments ([`angular-examples`](./apps/angular-examples))                |
| **Bacteria Wars**             | [bacteria-wars.wolsok.de](https://bacteria-wars.wolsok.de/)                         | [![Bacteria Wars](https://img.shields.io/website?url=https://bacteria-wars.wolsok.de/&label=status&up_message=online&down_message=offline)](https://bacteria-wars.wolsok.de/)                   | Two bacteria colonies, one petri dish. Play in the browser, install as PWA, or get the Android app ([`bacteria-game-remote`](./apps/bacteria-game-remote)) |
| **Bacteria Wars for Android** | [Google Play](https://play.google.com/store/apps/details?id=de.wolsok.bacteriawars) | [![Get it on Google Play](https://img.shields.io/badge/Google_Play-Bacteria_Wars-414141?logo=googleplay&logoColor=white)](https://play.google.com/store/apps/details?id=de.wolsok.bacteriawars) | Trusted Web Activity wrapping the Bacteria Wars PWA ([`bacteria-wars-android`](./apps/bacteria-wars-android))                                              |
| **Fourier Analysis**          | [fourier-analysis.wolsok.de](https://fourier-analysis.wolsok.de/)                   | [![Fourier Analysis](https://img.shields.io/website?url=https://fourier-analysis.wolsok.de/&label=status&up_message=online&down_message=offline)](https://fourier-analysis.wolsok.de/)          | Native Federation remote, also runs standalone ([`fourier-analysis-remote`](./apps/fourier-analysis-remote))                                               |
| **Shader Examples**           | [shader-examples.wolsok.de](https://shader-examples.wolsok.de/)                     | [![Shader Examples](https://img.shields.io/website?url=https://shader-examples.wolsok.de/&label=status&up_message=online&down_message=offline)](https://shader-examples.wolsok.de/)             | Native Federation remote with WebGL shaders ([`shader-examples-remote`](./apps/shader-examples-remote))                                                    |
| **Pacetrainer**               | [pace-trainer.com](https://pace-trainer.com/)                                       | [![Pacetrainer](https://img.shields.io/website?url=https://pace-trainer.com/&label=status&up_message=online&down_message=offline)](https://pace-trainer.com/)                                   | Pace training app built with Analog.js ([`pacetrainer`](./apps/pacetrainer))                                                                               |
| **RollaPolla**                | [rollapolla.com](https://rollapolla.com/)                                           | [![RollaPolla](https://img.shields.io/website?url=https://rollapolla.com/&label=status&up_message=online&down_message=offline)](https://rollapolla.com/)                                        | Polls, server-side rendered with Analog.js ([`rollapolla-analog`](./apps/rollapolla-analog))                                                               |

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
[![npm](https://img.shields.io/npm/v/@wolsok/thanos?logo=npm)](https://www.npmjs.com/package/@wolsok/thanos) [![downloads](https://img.shields.io/npm/dm/@wolsok/thanos)](https://www.npmjs.com/package/@wolsok/thanos)

Readme under: [README.md](./libs/public/ws-thanos/README.md)

A running version can be found at https://angularexamples.wolsok.de/

## nx-aws-cdk-v2

The Nx plugin that powers the `*-cdk` infrastructure projects in this repo lives here too, as
`libs/public/nx-aws-cdk-v2`. It provides `deploy`, `destroy`, `synth` and `bootstrap` executors plus an
application generator for AWS CDK v2 apps.
[![npm](https://img.shields.io/npm/v/@wolsok/nx-aws-cdk-v2?logo=npm)](https://www.npmjs.com/package/@wolsok/nx-aws-cdk-v2) [![downloads](https://img.shields.io/npm/dm/@wolsok/nx-aws-cdk-v2)](https://www.npmjs.com/package/@wolsok/nx-aws-cdk-v2)

Readme under: [README.md](./libs/public/nx-aws-cdk-v2/README.md), docs under [docs/nx-aws-cdk-v2](./docs/nx-aws-cdk-v2).

## Technology Stack

This monorepo leverages modern web technologies:

- **Framework**: Angular 20 with Signals, Standalone Components, and Zoneless Change Detection
- **Meta-framework**: Analog.js for SSR and file-based routing
- **Build Tools**: Nx 23, Vite, esbuild with Native Federation
- **State Management**: Angular Signals, RxJS, NgRx Signal Store, Akita/Elf
- **UI**: Angular Material, Angular CDK
- **Graphics**: Three.js, p5.js, WebGL
- **Testing**: Jest, Playwright, Vitest
- **Backend**: Firebase, tRPC, AWS CDK
- **Mobile**: Android Trusted Web Activity (Gradle), published on Google Play
- **Scientific**: TensorFlow.js, math.js, GPU.js, WebAssembly

## Project Structure

```
apps/          # Deployable applications
  ├── angular-examples/        # Main showcase app (Native Federation shell)
  ├── *-remote/               # Native Federation remotes
  ├── bacteria-wars-android/  # Android app (Trusted Web Activity)
  ├── pacetrainer/            # Pace training app (Analog.js)
  ├── rollapolla-analog/      # Polls (Analog.js SSR)
  └── *-cdk/                  # AWS CDK infra stacks

libs/          # Reusable libraries
  ├── features/               # Domain features
  ├── shared/                 # Shared logic
  ├── utils/                  # Utilities
  ├── ui-kit/                 # Reusable UI components
  └── public/                 # Published packages
```

See [Architecture Overview](./docs/ARCHITECTURE.md) for detailed structure.

## npm install

To run `npm install` you need to make sure `node-gyp` compilation process is working. See here: [node-gyp installation](https://github.com/nodejs/node-gyp#installation)

## Contributors

[![contributors](https://contrib.rocks/image?repo=WolfSoko/wol-sok-mono)](https://github.com/WolfSoko/wol-sok-mono/graphs/contributors)
