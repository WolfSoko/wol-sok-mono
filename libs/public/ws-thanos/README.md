# public-ws-thanos

An angular directive that vaporizes your DOM Elements like Thanos. This library is generated with [Nx](https://nx.dev).

#### Live Demo:

Click the technology cards on https://angularexamples.wolsok.de

## Usage

#### Dependencies:

To install run

```
npm install @wolsok/thanos --save
```

This lib uses html2canvas. So please run

```
npm install html2canvas --save.
```

#### Prepare your angular app:

Add to your root app module.

```
@NgModule({
  ...
  imports: [...
    WsThanosModule.forRoot(options)
  ]
})
export class AppModule {...}
```

And add PublicWsThanosModule to your shared module exports to make the directive available.

```
@NgModule({
  ...
  exports: [...
    WsThanosModule
  ]
})
export class SharedModule {...}
]
```

#### `WsThanosOptions` to configure public-ws-thanos:

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
<button (click)="thanos.vaporize(removeElement)">
```

### `WsThanosService` usage

Inject the 'WsThanosService' into your class. Call 'vaporize()' and subscribe to it.

## Collaboration

Send issues or PRs to https://github.com/wolsok/wol-sok-mono

Run `nx test ws-thanos` to execute the unit tests.

## Migration

* Remove old version `npm uninstall sc-thanos`
* Install `npm install @wolsok/thanos --save`
* The earlier name of this component was `scThanos`. Just switch to `wsThanos`

