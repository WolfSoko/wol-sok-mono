# Angular Framework Overview

## What is Angular?

Angular is a popular open-source web application framework developed and maintained by Google. It is used for building dynamic, single-page web applications (SPAs) using TypeScript. Angular provides a comprehensive platform for building modern web applications with a rich set of features and tools.

## Key Features

### 1. Component-Based Architecture
Angular applications are built using components, which are the fundamental building blocks. Each component consists of:
- **TypeScript class** - Contains the component's logic and data
- **HTML template** - Defines the component's view
- **CSS styles** - Defines the component's appearance

Example from this repository:
```typescript
@Component({
  selector: 'pace-root',
  imports: [RouterOutlet],
  template: ` <router-outlet></router-outlet> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
```

### 2. Two-Way Data Binding
Angular provides powerful data binding capabilities:
- **Property binding** - `[property]="value"`
- **Event binding** - `(event)="handler()"`
- **Two-way binding** - `[(ngModel)]="value"`

### 3. Dependency Injection
Angular has a built-in dependency injection system that makes it easy to manage dependencies and share services across components. Services are typically provided at the root level or component level.

### 4. Routing
Angular Router enables navigation between different views/components in your application. This repository uses AnalogJS file-based routing for a more intuitive routing experience.

### 5. Reactive Programming with RxJS
Angular leverages RxJS for handling asynchronous operations and events. This repository makes extensive use of RxJS observables for state management and data flow.

### 6. Modular Architecture
Angular applications are organized into modules (NgModules), though this repository uses standalone components (the modern approach introduced in Angular 14+) which don't require NgModules.

## Angular in This Repository

This monorepo uses Angular extensively across multiple applications:

### Version
- **Angular**: 20.3.7 (latest stable)
- **TypeScript**: For type-safe development
- **Analog.js**: Meta-framework for Angular providing file-based routing and Vite integration

### Applications
The repository contains several Angular applications under `apps/`:
- `pacetrainer` - Pace training application
- `rollapolla-analog` - Analog.js-based application
- `angular-examples` - Example implementations
- `fourier-analysis-remote` - Fourier analysis visualization
- `bacteria-game-remote` - Bacteria simulation game
- `shader-examples-remote` - WebGL shader examples

### Key Technologies & Libraries

#### UI Components
- **Angular Material** - Material Design component library
- **Angular CDK** - Component Development Kit for building custom components

#### State Management
- **Akita** - State management library based on RxJS
- Observable-based reactive state management

#### Visualization & Graphics
- **Three.js** - 3D graphics
- **p5.js** - Creative coding library
- **WebGL** - Custom shader programming

#### Backend & Deployment
- **Firebase** - Backend services and hosting
- **Angular SSR** - Server-side rendering
- **Analog.js** - Full-stack capabilities

### Modern Angular Features Used

#### 1. Standalone Components
```typescript
@Component({
  selector: 'my-component',
  imports: [CommonModule, RouterOutlet],  // Direct imports, no NgModule needed
  template: `...`
})
export class MyComponent {}
```

#### 2. Signals (New Reactive Primitive)
Angular's new reactive primitive for simpler state management (Angular 16+).

#### 3. Zoneless Change Detection
```typescript
provideZonelessChangeDetection()  // More efficient change detection without Zone.js
```

#### 4. Server-Side Rendering (SSR)
Enhanced hydration with incremental hydration and event replay:
```typescript
provideClientHydration(withIncrementalHydration(), withEventReplay())
```

#### 5. File-Based Routing (via Analog.js)
Uses file system for defining routes instead of manual router configuration.

## Development Guidelines

### Component Structure
- Use `ChangeDetectionStrategy.OnPush` for better performance
- Keep components focused and single-purpose
- Use standalone components (modern approach)

### Styling
- CSS Grid and Flexbox for layouts
- Angular Material components for UI consistency
- Component-scoped styles

### State Management
- RxJS observables for reactive data flow
- Akita for complex state management needs
- Services for shared state and business logic

### Testing
- Jest for unit testing
- Playwright for end-to-end testing
- Test files colocated with source files (`.spec.ts`)

### Build & Development
- **Vite** - Fast build tool (via Analog.js)
- **Nx** - Monorepo management and build orchestration
- **ESLint** - Code linting
- **Prettier** - Code formatting

## Angular CLI & Nx Commands

### Development
```bash
npx nx serve <project-name>      # Start dev server
npx nx build <project-name>      # Build production
npx nx test <project-name>       # Run unit tests
npx nx e2e <project-name>        # Run E2E tests
npx nx lint <project-name>       # Lint code
```

### Monorepo Commands
```bash
npx nx graph                     # Visualize project dependencies
npx nx affected -t build,test    # Build/test only affected projects
npx nx run-many -t build         # Run task across multiple projects
```

## Resources

### Official Documentation
- [Angular Documentation](https://angular.dev)
- [Angular API Reference](https://angular.dev/api)
- [Angular Style Guide](https://angular.dev/style-guide)

### Technologies Used
- [Analog.js](https://analogjs.org) - Angular meta-framework
- [Angular Material](https://material.angular.io) - Material Design components
- [RxJS](https://rxjs.dev) - Reactive programming
- [Nx](https://nx.dev) - Monorepo tools
- [Akita](https://datorama.github.io/akita/) - State management

### Learning Resources
- [Angular Tutorial](https://angular.dev/tutorials)
- [Angular University](https://angular-university.io)
- [RxJS Documentation](https://rxjs.dev/guide/overview)

## Contributing

When working with Angular in this repository:
1. Follow the Angular Style Guide
2. Use standalone components
3. Implement OnPush change detection where possible
4. Write unit tests for components and services
5. Use RxJS operators for reactive data transformations
6. Keep components small and focused
7. Use Angular Material components for UI consistency

## Architecture Principles

This repository follows these Angular best practices:
- **Separation of Concerns** - Components, services, and state management are clearly separated
- **Reactive Programming** - Heavy use of RxJS for data flow
- **Type Safety** - TypeScript for compile-time type checking
- **Modular Design** - Nx libraries for shared code
- **Testing** - Comprehensive unit and E2E tests
- **Performance** - OnPush change detection, lazy loading, and optimization

## Common Patterns

### Service Pattern
```typescript
@Injectable({ providedIn: 'root' })
export class DataService {
  private dataSubject = new BehaviorSubject<Data[]>([]);
  data$ = this.dataSubject.asObservable();
  
  updateData(data: Data[]) {
    this.dataSubject.next(data);
  }
}
```

### Smart/Dumb Component Pattern
- **Smart Components** (Containers) - Handle state and logic
- **Dumb Components** (Presentational) - Display data via inputs/outputs

### Observable Data Flow
```typescript
data$ = this.service.getData().pipe(
  map(data => transform(data)),
  catchError(error => handleError(error))
);
```

This document provides an overview of Angular and how it's used in this monorepo. For specific implementation details, refer to the code in `apps/` and `libs/` directories.
