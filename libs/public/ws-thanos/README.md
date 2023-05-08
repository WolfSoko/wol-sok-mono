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
