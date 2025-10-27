# Angular Framework Overview

> **Note**: This documentation is based on official Angular documentation from [angular.dev](https://angular.dev) and the [Angular GitHub repository](https://github.com/angular/angular).

## What is Angular?

Angular is a web framework that empowers developers to build fast, reliable applications. It is a platform and framework for building single-page client applications using HTML and TypeScript, developed and maintained by Google.

## Core Concepts

### Component-Based Architecture

Angular applications are built using components as the fundamental building blocks. Each component consists of:

- **TypeScript class** - Contains the component's logic and data
- **HTML template** - Defines the component's view
- **CSS styles** - Defines the component's appearance

**Example: Basic Component Definition**

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyComponent {}
```

**Example: Standalone Component (Modern Approach)**

```typescript
import { ProfilePhoto } from './profile-photo';

@Component({
  // Import the `ProfilePhoto` component in
  // order to use it in this component's template.
  imports: [ProfilePhoto],
  /* ... */
})
export class UserProfile {}
```

### Dependency Injection

Angular has a powerful built-in dependency injection system. Services and dependencies can be injected using the `inject()` function or constructor injection.

**Using the inject() Function**

```typescript
import { inject, Component } from '@angular/core';

@Component({
  /* ... */
})
export class UserProfile {
  // You can use the `inject` function in property initializers.
  private userClient = inject(UserClient);

  constructor() {
    // You can also use the `inject` function in a constructor.
    const logger = inject(Logger);
  }
}
```

**Providing Services at Component Level**

```typescript
@Component({
  selector: 'hero-list',
  template: '...',
  providers: [HeroService],
})
class HeroListComponent {}
```

**Service with Dependencies**

```typescript
import { inject } from '@angular/core';

export class HeroService {
  private heroes: Hero[] = [];

  private backend = inject(BackendService);
  private logger = inject(Logger);

  async getHeroes() {
    // Fetch
    this.heroes = await this.backend.getAll(Hero);
    // Log
    this.logger.log(`Fetched ${this.heroes.length} heroes.`);
    return this.heroes;
  }
}
```

### Angular Signals

Signals are Angular's modern reactive primitive for managing state and derived values.

**Creating and Using Signals**

```typescript
import { signal } from '@angular/core';

// Create a signal with the `signal` function.
const firstName = signal('Morgan');

// Read a signal value by calling it— signals are functions.
console.log(firstName());

// Change the value of this signal by calling its `set` method with a new value.
firstName.set('Jaime');

// You can also use the `update` method to change the value
// based on the previous value.
firstName.update((name) => name.toUpperCase());
```

**Computed Signals**

```typescript
import { signal, computed } from '@angular/core';

const firstName = signal('Morgan');
const firstNameCapitalized = computed(() => firstName().toUpperCase());

console.log(firstNameCapitalized()); // MORGAN

firstName.set('Jaime');
console.log(firstNameCapitalized()); // JAIME
```

**Signals in Components**

```typescript
@Component({
  /* ... */
})
export class UserProfile {
  isTrial = signal(false);
  isTrialExpired = signal(false);
  showTrialDuration = computed(() => this.isTrial() && !this.isTrialExpired());

  activateTrial() {
    this.isTrial.set(true);
  }
}
```

**Linked Signals for Dependent State**

```typescript
@Component({
  /* ... */
})
export class ShippingMethodPicker {
  shippingOptions: Signal<ShippingMethod[]> = getShippingOptions();

  // Initialize selectedOption to the first shipping option.
  selectedOption = linkedSignal(() => this.shippingOptions()[0]);

  changeShipping(index: number) {
    this.selectedOption.set(this.shippingOptions()[index]);
  }
}
```

### Effects

Effects allow you to schedule side-effectful functions that run when signals change.

```typescript
const counter = signal(0);
effect(() => console.log('The counter is:', counter()));
// The counter is: 0

counter.set(1);
// The counter is: 1
```

### RxJS Interoperability

Angular provides seamless integration between Signals and RxJS Observables.

**Converting Signal to Observable**

```typescript
import { Component, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';

@Component(...)
export class SearchResults {
  query: Signal<string> = inject(QueryService).query;
  query$ = toObservable(this.query);

  results$ = this.query$.pipe(
    switchMap(query => this.http.get('/search?q=' + query ))
  );
}
```

**Displaying Asynchronous Data with AsyncPipe**

```typescript
import { AsyncPipe } from '@angular/common';
@Component({
  imports: [AsyncPipe],
  template: `
    @if (user$ | async; as user) {
      <p>Name: {{ user.name }}</p>
      <p>Biography: {{ user.biography }}</p>
    }
  `,
})
export class UserProfileComponent {
  @Input() userId!: string;
  user$!: Observable<User>;

  private userService = inject(UserService);

  constructor() {
    this.user$ = this.userService.getUser(this.userId);
  }
}
```

### Templates and Data Binding

**Interpolation**

```typescript
@Component({
  selector: 'user-profile',
  template: `<h1>Profile for {{ userName() }}</h1>`,
})
export class TodoListItem {
  userName = signal('pro_programmer_123');
}
```

Rendered output:

```html
<h1>Profile for pro_programmer_123</h1>
```

**Two-Way Binding with Model Inputs**

```typescript
@Component({
  /* ... */
  // Using the two-way binding syntax means that any changes to the slider's
  // value automatically propagate back to the `volume` signal.
  // Note that this binding uses the signal *instance*, not the signal value.
  template: `<custom-slider [(value)]="volume" />`,
})
export class MediaControls {
  // Create a writable signal for the `volume` local state.
  volume = signal(0);
}
```

### Routing

**Reading Route Parameters**

```typescript
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-product-detail',
  template: `<h1>Product Details: {{ productId() }}</h1>`,
})
export class ProductDetailComponent {
  productId = signal('');
  private activatedRoute = inject(ActivatedRoute);

  constructor() {
    // Access route parameters
    this.activatedRoute.params.subscribe((params) => {
      this.productId.set(params['id']);
    });
  }
}
```

**Binding Route Parameters to Component Inputs**

```typescript
@Input()
set id(heroId: string) {
  this.hero$ = this.service.getHero(heroId);
}
```

**Defining Routes with Providers**

```typescript
export const ROUTES: Route[] = [
  {
    path: 'admin',
    providers: [AdminService, { provide: ADMIN_API_KEY, useValue: '12345' }],
    children: [
      { path: 'users', component: AdminUsersComponent },
      { path: 'teams', component: AdminTeamsComponent },
    ],
  },
  // ... other application routes that don't
  //     have access to ADMIN_API_KEY or AdminService.
];
```

**Router Outlet**

```html
<!-- Content rendered on the page when the user visits /admin -->
<app-header>...</app-header>
<router-outlet></router-outlet>
<app-admin-page>...</app-admin-page>
<app-footer>...</app-footer>
```

**Enabling View Transitions**

```typescript
// Standalone bootstrap
bootstrapApplication(MyApp, {
  providers: [provideRouter(ROUTES, withViewTransitions())],
});
```

## Modern Angular Features

### Zoneless Change Detection

Angular now supports zoneless change detection for improved performance.

**Enabling Zoneless Change Detection**

```typescript
// standalone bootstrap
bootstrapApplication(MyApp, { providers: [provideZonelessChangeDetection()] });

// NgModule bootstrap
platformBrowser().bootstrapModule(AppModule);
@NgModule({
  providers: [provideZonelessChangeDetection()],
})
export class AppModule {}
```

**Testing with Zoneless Change Detection**

```typescript
TestBed.configureTestingModule({
  providers: [provideZonelessChangeDetection()],
});

const fixture = TestBed.createComponent(MyComponent);
await fixture.whenStable();
```

### Change Detection Strategies

**OnPush Change Detection**

```typescript
import { ChangeDetectionStrategy, Component } from '@angular/core';
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyComponent {}
```

### Server-Side Rendering (SSR)

**Defining Server Routes**

```typescript
// app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '', // This renders the "/" route on the client (CSR)
    renderMode: RenderMode.Client,
  },
  {
    path: 'about', // This page is static, so we prerender it (SSG)
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'profile', // This page requires user-specific data, so we use SSR
    renderMode: RenderMode.Server,
  },
  {
    path: '**', // All other routes will be rendered on the server (SSR)
    renderMode: RenderMode.Server,
  },
];
```

**Providing Server Rendering**

```typescript
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { serverRoutes } from './app.routes.server';

// app.config.server.ts
const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    // ... other providers ...
  ],
};
```

**Accessing Request Object in SSR**

```typescript
import { inject, REQUEST } from '@angular/core';

@Component({
  selector: 'app-my-component',
  template: `<h1>My Component</h1>`,
})
export class MyComponent {
  constructor() {
    const request = inject(REQUEST);
    console.log(request?.url);
  }
}
```

**Prerendering with Parameters**

```typescript
// app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: 'post/:id',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      const dataService = inject(PostService);
      const ids = await dataService.getIds(); // Assuming this returns ['1', '2', '3']

      return ids.map((id) => ({ id })); // Generates paths like: /post/1, /post/2, /post/3
    },
  },
  {
    path: 'post/:id/**',
    renderMode: RenderMode.Prerender,
    async getPrerenderParams() {
      return [
        { id: '1', '**': 'foo/3' },
        { id: '2', '**': 'bar/4' },
      ]; // Generates paths like: /post/1/foo/3, /post/2/bar/4
    },
  },
];
```

**Client Hydration**

```typescript
import {
  bootstrapApplication,
  provideClientHydration,
} from '@angular/platform-browser';
...

bootstrapApplication(AppComponent, {
  providers: [provideClientHydration()]
});
```

### Resources API

The Resources API provides a way to load data reactively based on signal parameters.

```typescript
import { resource, Signal } from '@angular/core';

const userId: Signal<string> = getUserId();

const userResource = resource({
  // Define a reactive computation.
  // The params value recomputes whenever any read signals change.
  params: () => ({ id: userId() }),

  // Define an async loader that retrieves data.
  // The resource calls this function every time the `params` value changes.
  loader: ({ params }) => fetchUser(params),
});

// Create a computed signal based on the result of the resource's loader function.
const firstName = computed(() => userResource.value().firstName);
```

## Testing

### Basic Component Testing

**Testing with Change Detection**

```typescript
it('should display original title', () => {
  fixture.detectChanges();
  expect(h1.textContent).toContain('Test Tour of Heroes');
});
```

**Testing with Updated Properties**

```typescript
it('should display a different test title', () => {
  component.title = 'New Test Title';
  fixture.detectChanges();
  expect(h1.textContent).toContain('New Test Title');
});
```

### Automatic Change Detection in Tests

**Configuring Automatic Change Detection**

```typescript
beforeEach(async () => {
  await TestBed.configureTestingModule({
    imports: [BannerComponent],
    providers: [{ provide: ComponentFixtureAutoDetect, useValue: true }],
  }).compileComponents();

  fixture = TestBed.createComponent(BannerComponent);
  component = fixture.componentInstance;
  h1 = fixture.nativeElement.querySelector('h1');
});
```

**Tests with Automatic Change Detection**

```typescript
it('should display original title', () => {
  // No fixture.detectChanges() needed
  expect(h1.textContent).toContain(component.title);
});

it('should display updated title after property change', async () => {
  component.title = 'New Title';
  // No fixture.detectChanges() needed, but must wait for async update
  await fixture.whenStable();
  expect(h1.textContent).toContain('New Title');
});
```

### Manual Change Detection Testing

**Disabling Automatic Change Detection**

```typescript
it('checks state while async action is in progress', async () => {
  const buttonHarness = loader.getHarness(MyButtonHarness);
  await manualChangeDetection(async () => {
    await buttonHarness.click();
    fixture.detectChanges();
    // Check expectations while async click operation is in progress.
    expect(isProgressSpinnerVisible()).toBe(true);
    await fixture.whenStable();
    // Check expectations after async click operation complete.
    expect(isProgressSpinnerVisible()).toBe(false);
  });
});
```

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

### Modern Angular Features Used in This Repository

This monorepo leverages modern Angular features including:

#### 1. Standalone Components

All components use the standalone API without NgModules:

```typescript
@Component({
  selector: 'pace-root',
  imports: [RouterOutlet],
  template: ` <router-outlet></router-outlet> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
```

#### 2. Signals

Using Angular's reactive primitives for state management.

#### 3. Zoneless Change Detection

```typescript
provideZonelessChangeDetection(); // More efficient change detection
```

#### 4. Server-Side Rendering with Hydration

```typescript
provideClientHydration(withIncrementalHydration(), withEventReplay());
```

#### 5. File-Based Routing (via Analog.js)

Uses Analog.js file system routing for intuitive route definitions.

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

- Angular Signals for reactive state
- RxJS observables for async operations
- Akita for complex state management
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

## Nx Commands

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

### Official Angular Documentation

- [Angular Documentation](https://angular.dev) - Official docs
- [Angular API Reference](https://angular.dev/api) - API documentation
- [Angular Style Guide](https://angular.dev/style-guide) - Best practices
- [Angular GitHub Repository](https://github.com/angular/angular) - Source code

### Technologies Used in This Monorepo

- [Analog.js](https://analogjs.org) - Angular meta-framework
- [Angular Material](https://material.angular.io) - Material Design components
- [RxJS](https://rxjs.dev) - Reactive programming
- [Nx](https://nx.dev) - Monorepo tools
- [Akita](https://datorama.github.io/akita/) - State management
- [Three.js](https://threejs.org) - 3D graphics library
- [p5.js](https://p5js.org) - Creative coding library

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
5. Use Angular Signals for reactive state
6. Use RxJS operators for async data transformations
7. Keep components small and focused
8. Use Angular Material components for UI consistency

## Architecture Principles

This repository follows these Angular best practices:

- **Separation of Concerns** - Components, services, and state management are clearly separated
- **Reactive Programming** - Heavy use of Signals and RxJS for data flow
- **Type Safety** - TypeScript for compile-time type checking
- **Modular Design** - Nx libraries for shared code
- **Testing** - Comprehensive unit and E2E tests
- **Performance** - OnPush change detection, lazy loading, and optimization

---

_This document is based on official Angular documentation from [angular.dev](https://angular.dev) and adapted for this monorepo's specific setup. For detailed implementation examples, refer to the code in `apps/` and `libs/` directories._
