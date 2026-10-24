import { DOCUMENT, Injectable, inject } from '@angular/core';

import { default as html2canvas } from 'html2canvas';
import {
  animationFrames,
  defer,
  finalize,
  from,
  map,
  Observable,
  switchMap,
  takeWhile,
  tap,
} from 'rxjs';
import { AnimationState } from './animation.state';
import { fitImagesForCapture } from './fit-images';
import {
  chooseParticleRenderer,
  GpuContextBudget,
  ParticleRendererChoice,
} from './choose-particle-renderer';
import { ParticleRenderer } from './particle-renderer';
import { createParticles, Particles } from './particles';
import { SnapSound, SnapSoundService } from './snap-sound.service';
import { frontGeometry } from './vaporizing-front';
import { EffectMargins, effectMargins, effectScale, windOf } from './wind';
import { WS_THANOS_OPTIONS_TOKEN } from './ws-thanos-options.token';
import type { WsThanosOptions } from './ws-thanos.options';

/** a short cross fade hides small differences between capture and element */
const FULL_COVERAGE_FADE_OUT_MS = 200;

/**
 * The longest step the simulation takes: after a stalled frame or a hidden tab
 * the particles carry on instead of jumping away.
 */
const MAX_FRAME_SEC = 0.1;

interface RunningEffect {
  renderer: ParticleRenderer;
  sound?: SnapSound;
}

/** the captured element, its css size and the device pixels per css pixel */
interface Capture {
  imageData: ImageData;
  width: number;
  height: number;
  scale: number;
}

/** resolves once the browser has nothing else to do */
function idle(window: Window): Promise<void> {
  return new Promise((resolve) =>
    typeof window.requestIdleCallback === 'function'
      ? window.requestIdleCallback(() => resolve())
      : window.setTimeout(resolve, 200)
  );
}

@Injectable({ providedIn: 'root' })
export class WsThanosService {
  private readonly thanosOptions: WsThanosOptions = inject(
    WS_THANOS_OPTIONS_TOKEN
  );
  private readonly document = inject(DOCUMENT);
  private readonly snapSound = inject(SnapSoundService);
  /** shared by all effects, browsers only allow a few WebGL contexts */
  private readonly gpuBudget = new GpuContextBudget();
  private preloaded?: Promise<void>;

  /**
   * start the vaporize-effect.
   * @param options override the provided options for this element
   */
  public vaporize(
    elem: HTMLElement,
    options?: Partial<WsThanosOptions>
  ): Observable<AnimationState> {
    // nothing is prepared before someone subscribes
    return defer(() =>
      this.vaporizeIntern(elem, { ...this.thanosOptions, ...options })
    );
  }

  /**
   * Snap a tiny invisible element once, so the first real snap starts without a stutter:
   * html2canvas, reading back its canvas and compiling the WebGL shaders are slow the first time.
   * Runs once while the browser is idle, the directive starts it unless `preload` is off.
   */
  public preload(): Promise<void> {
    this.preloaded ??= this.preloadIntern().catch((error) =>
      console.debug('ws-thanos: preload failed', error)
    );
    return this.preloaded;
  }

  private async preloadIntern(): Promise<void> {
    const { body, defaultView: window } = this.document;
    if (window == null || body == null) {
      return;
    }
    await idle(window);

    const elem = this.document.createElement('div');
    elem.textContent = 'ws';
    elem.setAttribute('aria-hidden', 'true');
    // draws what cards usually draw: text, a gradient, rounded borders and a shadow.
    // html2canvas ignores clip-path, so it captures the element while the page shows nothing
    elem.style.cssText = [
      'position:fixed;left:0;top:0;width:32px;height:32px',
      'clip-path:inset(50%);pointer-events:none',
      'border:2px solid #888;border-radius:8px;box-shadow:0 2px 4px #0004',
      'background:linear-gradient(#fff,#888)',
    ].join(';');
    body.appendChild(elem);

    const {
      maxParticleCount,
      maxCapturePixels,
      particleAcceleration,
      windDirection,
    } = this.thanosOptions;
    let rendererChoice: ParticleRendererChoice | undefined;
    let renderer: ParticleRenderer | undefined;
    try {
      // the scale does not matter for a warm up
      const capture = await this.capture(elem, () => 1);
      await idle(window);
      // take a WebGL context only now, not while waiting for idle time
      rendererChoice = this.chooseRenderer(maxParticleCount, maxCapturePixels);
      // dust skips the crack shader, the other variants compile every shader
      ({ renderer } = this.createRenderer(rendererChoice, capture, {
        particleAcceleration,
        crumble: 'shards',
        windDirection,
        margins: effectMargins(windDirection),
      }));
      renderer.render({
        deltaTSec: 0,
        animationT: 0,
        maxWidth: renderer.canvas.width,
        maxHeight: renderer.canvas.height,
      });
    } finally {
      renderer?.dispose();
      elem.remove();
      rendererChoice?.release();
    }
  }

  private vaporizeIntern(
    elem: HTMLElement,
    options: WsThanosOptions
  ): Observable<AnimationState> {
    const {
      animationLength,
      maxParticleCount,
      maxCapturePixels,
      particleAcceleration,
      crumble,
      windDirection,
    } = options;

    elem.style.opacity = elem.style.opacity || '1';

    const rendererChoice = this.chooseRenderer(
      maxParticleCount,
      maxCapturePixels
    );
    let effect: RunningEffect | undefined;

    const margins = effectMargins(windDirection);
    const capture = this.capture(elem, (width, height) =>
      rendererChoice.captureScale(width, height, effectScale(margins))
    );
    return from(capture).pipe(
      map((capture): RunningEffect => {
        const { renderer, particles } = this.createRenderer(
          rendererChoice,
          capture,
          { particleAcceleration, crumble, windDirection, margins }
        );

        this.placeEffectCanvas(
          elem,
          renderer.canvas,
          capture.width,
          capture.height,
          margins
        );
        renderer.canvas.dataset['wsThanosRenderer'] = renderer.kind;
        renderer.canvas.dataset['wsThanosCrumble'] = renderer.crumble;
        // when every pixel became a particle, the particles replace the element right away
        const fadeOutMs = particles.sampled
          ? Math.floor(animationLength * 0.8)
          : FULL_COVERAGE_FADE_OUT_MS;
        elem.style.transition = `opacity ${fadeOutMs}ms ease-out`;
        elem.style.opacity = '0';

        const { sound, soundVolume } = options;
        effect = {
          renderer,
          sound: sound
            ? this.snapSound.play(
                animationLength,
                soundVolume,
                renderer.crumble
              )
            : undefined,
        };
        return effect;
      }),
      switchMap(({ renderer, sound }) => {
        let previous = 0;
        // one step per frame the screen shows, at whatever rate it refreshes
        return animationFrames().pipe(
          map(({ elapsed }): AnimationState => {
            const deltaTSec = Math.min(
              (elapsed - previous) / 1000,
              MAX_FRAME_SEC
            );
            previous = elapsed;
            return {
              deltaTSec,
              animationT: elapsed / animationLength,
              maxWidth: renderer.canvas.width,
              maxHeight: renderer.canvas.height,
            };
          }),
          tap((animationState) => renderer.render(animationState)),
          takeWhile((animationState) => animationState.animationT <= 1),
          // a completed effect lets the sound blow away, a cancelled one stops it
          tap({ unsubscribe: () => sound?.stop(), error: () => sound?.stop() })
        );
      }),
      finalize(() => {
        effect?.renderer.dispose();
        rendererChoice.release();
      })
    );
  }

  private chooseRenderer(
    maxParticleCount: number,
    maxCapturePixels: number | undefined
  ): ParticleRendererChoice {
    return chooseParticleRenderer({
      maxParticleCount,
      maxCapturePixels,
      devicePixelRatio: this.document.defaultView?.devicePixelRatio ?? 1,
      createCanvas: () => this.document.createElement('canvas'),
      gpuBudget: this.gpuBudget,
    });
  }

  /** draw the element into an image at the scale the renderer needs */
  private async capture(
    elem: HTMLElement,
    captureScale: (width: number, height: number) => number
  ): Promise<Capture> {
    const window = this.document.defaultView;
    const { width, height } = elem.getBoundingClientRect();
    const scale = captureScale(width, height);
    // a canvas that is read back is drawn on the CPU: a GPU canvas would compile
    // the shaders for everything html2canvas draws on the first read back
    const canvas = this.document.createElement('canvas');
    canvas.width = Math.floor(Math.ceil(width) * scale);
    canvas.height = Math.floor(Math.ceil(height) * scale);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (context == null) {
      throw new Error('Could not get a 2d context for the capture');
    }
    await html2canvas(elem, {
      canvas,
      backgroundColor: null,
      scale,
      allowTaint: true,
      windowHeight: window?.innerHeight,
      windowWidth: window?.innerWidth,
      scrollY: -(window?.scrollY ?? 0),
      onclone: (_document, clonedElem) =>
        fitImagesForCapture(clonedElem, scale),
    });
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    return { imageData, width, height, scale };
  }

  /** the effect canvas reaches past the element where the wind blows the dust */
  private createRenderer(
    rendererChoice: ParticleRendererChoice,
    { imageData, scale }: Capture,
    {
      particleAcceleration,
      crumble,
      windDirection,
      margins,
    }: Pick<
      WsThanosOptions,
      'particleAcceleration' | 'crumble' | 'windDirection'
    > & { margins: EffectMargins }
  ): { renderer: ParticleRenderer; particles: Particles } {
    const { width, height } = imageData;
    const offsetX = Math.round(width * margins.left);
    const offsetY = Math.round(height * margins.top);
    const bottom = Math.round(height * margins.bottom);
    const particles = createParticles(
      imageData,
      rendererChoice.maxParticleCount,
      { x: offsetX, y: offsetY }
    );
    const wind = windOf(windDirection);
    const renderer = rendererChoice.create(particles, {
      width: offsetX + width + Math.round(width * margins.right),
      height: offsetY + height + bottom,
      // particles move in device pixels, keep their speed in css pixels
      particleAcceleration: particleAcceleration * scale,
      pixelScale: scale,
      crumble,
      seed: Math.random() * 1000,
      wind,
      front: frontGeometry(particles.bounds, wind, { top: offsetY, bottom }),
    });
    return { renderer, particles };
  }

  /** the effect canvas covers the element and the margins around it */
  private placeEffectCanvas(
    elem: HTMLElement,
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    margins: EffectMargins
  ): void {
    const { left, top } = this.offsetInParent(elem);
    const scale = effectScale(margins);
    canvas.style.position = 'absolute';
    canvas.style.left = `${left - width * margins.left}px`;
    canvas.style.top = `${top - height * margins.top}px`;
    canvas.style.width = `${width * scale.width}px`;
    canvas.style.height = `${height * scale.height}px`;
    canvas.style.zIndex = '2000';
    canvas.style.pointerEvents = 'none';
    elem.insertAdjacentElement('beforebegin', canvas);
  }

  /** position of the element inside its parent, where absolute children are placed */
  private offsetInParent(elem: HTMLElement): { left: number; top: number } {
    const parent = elem.parentElement;
    if (parent == null) {
      return { left: 0, top: 0 };
    }
    parent.style.position = parent.style.position || 'relative';
    // absolute positions are relative to the parent's padding box
    const elemRect = elem.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return {
      left:
        elemRect.left - parentRect.left - parent.clientLeft + parent.scrollLeft,
      top: elemRect.top - parentRect.top - parent.clientTop + parent.scrollTop,
    };
  }
}
