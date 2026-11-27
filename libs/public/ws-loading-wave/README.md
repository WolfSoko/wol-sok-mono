# @wolsok/loading-wave

A calm loading effect for Angular: a grid of small dots behind any element,
crossed again and again by a curved wave front that lights the dots it
passes. It lies in the background, so it shows that something loads without
pulling the eye away from the content.

Try it in the [playground](https://angularexamples.wolsok.de/loadingWavePlayground).

- **One directive**, a boolean input: `[wsLoadingWave]="loading()"`.
- **On the GPU where there is one:** a WebGL2 shader adds a soft glow around
  the lit dots, an echo ripple trailing the front and a push through the
  grid.
- **Everywhere else on a 2D canvas:** without a GPU (or when the browser
  would render WebGL on the CPU), when the shader fails, when more than 8
  waves run on one page or when the GPU context is lost.
- **After loading** the dots fade away (`'hide'`) or stay as a quiet dotted
  background (`'keep'`).
- **Polite:** no wave with `prefers-reduced-motion`, paused off screen,
  nothing on the server, `aria-busy` on the host while loading, the canvas
  hidden from assistive technology.

## Install

```bash
npm install @wolsok/loading-wave
```

Peer dependency: `@angular/core` 20, 21 or 22. No other dependency.

## Use

```ts
import { Component, signal } from '@angular/core';
import { LoadingWaveDirective } from '@wolsok/loading-wave';

@Component({
  selector: 'app-results',
  imports: [LoadingWaveDirective],
  template: `
    <section class="results" [wsLoadingWave]="loading()">
      @if (loading()) {
        <p>Loading results…</p>
      } @else {
        <app-result-list />
      }
    </section>
  `,
})
export class ResultsComponent {
  protected readonly loading = signal(true);
}
```

The directive puts one canvas behind the host's content (`z-index: -1` in a
stacking context of the host: it gives the host `isolation: isolate`, and
`position: relative` where it was `static`). Give the host a size and,
for the look of the video, a dark background.

### Options

Per element with `[wsLoadingWaveOptions]`, or app-wide with
`provideLoadingWave(…)` in your providers:

```html
<header
  [wsLoadingWave]="intro()"
  [wsLoadingWaveOptions]="{ afterLoading: 'keep', dotSpacing: 24 }"
>
```

```ts
bootstrapApplication(AppComponent, {
  providers: [provideLoadingWave({ color: 'var(--mat-sys-primary)' })],
});
```

| Option         | Default       | What it does                                                                                                         |
| -------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `afterLoading` | `'hide'`      | `'hide'`: dots and wave fade out, the canvas goes. `'keep'`: the wave fades out, the dots stay.                      |
| `dotSpacing`   | `28`          | distance between two dots, CSS pixels                                                                                |
| `dotSize`      | `1.5`         | diameter of a dot at rest, CSS pixels                                                                                |
| `color`        | host's colour | any CSS colour, variables included; unset, the dots take the host's `currentColor`                                   |
| `sweepMs`      | `1600`        | one sweep of the wave across the element, milliseconds                                                               |
| `renderer`     | `'auto'`      | `'auto'`: the shader on a GPU; `'webgl'`: also in software; both fall back to the 2D canvas. `'canvas'`: never WebGL |

The dots follow the host's colour through theme changes (a class or
attribute on `<html>` or `<body>`, or the system's colour scheme).

`exportAs: 'wsLoadingWave'` gives the template the directive; its
`activeRenderer()` signal says what draws right now (`'webgl'`, `'canvas'` or
`null`).

## License

MIT
