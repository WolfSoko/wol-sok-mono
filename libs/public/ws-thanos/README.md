# @wolsok/thanos

An angular directive that vaporizes your DOM Elements like Thanos snaps his fingers. This library is generated with [Nx](https://nx.dev).

#### Live Demo:

Click the technology cards on https://angularexamples.wolsok.de/home?thanosDemo=true

## Usage

#### Dependencies:

To install run

```
npm install @wolsok/thanos --save
```

#### Prepare your angular app:

Add `WsThanosDirective` to your module/standalone component.

```typescript
@NgModule_or_@Component({
  ...,
  imports: [
    ...
    WsThanosDirective
  ],
  providers: [
    // override the default options
    provideWsThanosOptions({
      animationLength: 2000,
      particleAcceleration: 50,
      maxParticleCount: 10000
    }),
  ]
})
```

You can also add WsThanosDirective to your shared module exports.

```typescript
@NgModule({
  imports: [WsThanosDirective],
  exports: [WsThanosDirective],
})
export class SharedModule {}
```

#### `WsThanosOptions` to configure ws-thanos:

| field                |  type  | default |                        description |
| -------------------- | :----: | ------: | ---------------------------------: |
| animationLength      | number |    5000 |         the animation length in ms |
| maxParticleCount     | number |  400000 |            max amount of particles |
| particleAcceleration | number |      30 | speed of the particle acceleration |

### `WsThanosDirective` usage

Use the directive `wsThanos` on your element and reference it using `@ViewChild(WsThanosDirective)` in your component or
directly in html via template ref:

```
<div wsThanos
  #thanos="thanos"
  (wsThanosComplete)=onComplete()>
  This div will be vaporized on click
  </div>
<button (click)="thanos.vaporizeAndScrollIntoView(removeElement)">
```

### `WsThanosService` usage

Inject the 'WsThanosService' into your class. Call 'vaporizeAndScrollIntoView(removeElement)' and subscribe to it.

## Collaboration

Send issues or PRs to https://github.com/wolsok/wol-sok-mono

Run `nx test ws-thanos` to execute unit tests.

## Publishing

This package is published to npm as `@wolsok/thanos` using Nx Release.

### Local Testing (Dry Run)

```bash
# Build the package
nx build ws-thanos

# Test publishing without actually publishing
nx release publish --dry-run
```

### Publishing via CI/CD

The package is automatically published when:

1. A release tag is created (e.g., `v4.8.7`)
2. The deploy workflow detects changes affecting ws-thanos
3. `nx release publish` runs in the CI/CD pipeline

The workflow uses Nx's built-in release capabilities with:

- Automatic versioning based on conventional commits
- Changelog generation (see CHANGELOG.md in this directory)
- NPM provenance for enhanced security

### Manual Publishing

To manually publish (requires npm authentication):

```bash
# Login to npm
npm login

# Build the package
nx build ws-thanos --configuration=production

# Publish using Nx Release
nx release publish
```

### Versioning

This project uses Nx Release with independent versioning. Version bumps are determined by:

- Conventional commit messages (feat: = minor, fix: = patch, BREAKING CHANGE: = major)
- Manual version specification via `nx release version [version]`

See the [Nx Release documentation](https://nx.dev/features/manage-releases) for more details.

## Migration

From `1.0.1` to `2.0.0`

- Replace `WsThanosModule` in imports and exports with `WsThanosDirective`
- Replace `WsThanosModule.forRoot(options)`:
  Before:
  ```typescript
  @NgModule({
   imports: [WsThanosModule.forRoot(options)]
  })
  ```
  After:
  ```typescript
  @NgModule({
   imports: [WsThanosDirective],
   providers: [
     provideWsThanosOptions(options)
   ]
  })
  ```

From: `sc-thanos` to `@wolsok/thanos`

- Remove old version `npm uninstall sc-thanos`
- Install `npm install @wolsok/thanos --save`
- The earlier name of this component was `scThanos`. Just switch to `wsThanos`
