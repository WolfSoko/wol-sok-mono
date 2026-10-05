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

| field                |  type   | default |                                                          description |
| -------------------- | :-----: | ------: | -------------------------------------------------------------------: |
| animationLength      | number  |    5000 |                                           the animation length in ms |
| maxParticleCount     | number  | 1500000 | max amount of particles (capped at 400000 without WebGL2, see below) |
| particleAcceleration | number  |      30 |                                   speed of the particle acceleration |
| sound                | boolean |    true |                           play a windy, sandy sound while vaporizing |
| soundVolume          | number  |     0.5 |                                      volume of the sound from 0 to 1 |

#### Sound

Every snap plays a windy, sandy sound, generated live with the Web Audio API (no audio files are downloaded),
timed to `animationLength` and slightly different every time.
Browsers only allow audio after the user interacted with the page, so snaps before the first click or tap stay silent.
Turn it off with `provideWsThanosOptions({ sound: false })`.

#### GPU rendering

The particles are simulated and drawn on the graphics card with WebGL2,
one particle per device pixel (up to a pixel ratio of 2) for crisp results on high resolution screens.
Without WebGL2 ws-thanos falls back to the CPU canvas renderer, which captures at css pixels and uses at most 400000 particles.
The effect canvas has a `data-ws-thanos-renderer` attribute (`webgl` or `canvas`) showing which renderer is in use.

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
