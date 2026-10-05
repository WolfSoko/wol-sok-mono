import { DOCUMENT, Injectable, inject } from '@angular/core';

import { default as html2canvas } from 'html2canvas';
import {
  animationFrameScheduler,
  finalize,
  from,
  interval,
  map,
  Observable,
  switchMap,
  takeWhile,
  tap,
  timeInterval,
} from 'rxjs';
import { AnimationState } from './animation.state';
import { EFFECT_HEIGHT_SCALE, EFFECT_WIDTH_SCALE } from './capture-scale';
import { chooseParticleRenderer } from './choose-particle-renderer';
import { ParticleRenderer } from './particle-renderer';
import { createParticles } from './particles';
import { SnapSound, SnapSoundService } from './snap-sound.service';
import { WS_THANOS_OPTIONS_TOKEN } from './ws-thanos-options.token';
import type { WsThanosOptions } from './ws-thanos.options';

/** a short cross fade hides small differences between capture and element */
const FULL_COVERAGE_FADE_OUT_MS = 200;

interface RunningEffect {
  renderer: ParticleRenderer;
  sound?: SnapSound;
}

@Injectable({ providedIn: 'root' })
export class WsThanosService {
  private readonly thanosOptions: WsThanosOptions = inject(
    WS_THANOS_OPTIONS_TOKEN
  );
  private readonly document = inject(DOCUMENT);
  private readonly snapSound = inject(SnapSoundService);

  /**
   * start the vaporize-effect.
   * @param options override the provided options for this element
   */
  public vaporize(
    elem: HTMLElement,
    options?: Partial<WsThanosOptions>
  ): Observable<AnimationState> {
    return this.vaporizeIntern(elem, { ...this.thanosOptions, ...options });
  }

  private vaporizeIntern(
    elem: HTMLElement,
    options: WsThanosOptions
  ): Observable<AnimationState> {
    const { animationLength, maxParticleCount, particleAcceleration, crumble } =
      options;
    const window = this.document.defaultView;

    elem.style.opacity = elem.style.opacity || '1';

    const rendererChoice = chooseParticleRenderer({
      maxParticleCount,
      devicePixelRatio: window?.devicePixelRatio ?? 1,
      createCanvas: () => this.document.createElement('canvas'),
    });
    const { width, height } = elem.getBoundingClientRect();
    const scale = rendererChoice.captureScale(width, height);
    const seed = Math.random() * 1000;

    const html2CanvasPromise: Promise<HTMLCanvasElement> = html2canvas(elem, {
      backgroundColor: null,
      scale,
      allowTaint: true,
      windowHeight: window?.innerHeight,
      windowWidth: window?.innerWidth,
      scrollY: -(window?.scrollY ?? 0),
    });

    return from(html2CanvasPromise).pipe(
      map((capturedElem): RunningEffect => {
        const effectWidth = capturedElem.width * EFFECT_WIDTH_SCALE;
        const effectHeight = capturedElem.height * EFFECT_HEIGHT_SCALE;
        const imageData = capturedElem
          .getContext('2d', { willReadFrequently: true })
          ?.getImageData(0, 0, capturedElem.width, capturedElem.height);
        if (imageData == null) {
          throw new Error('Could not get image data from canvas');
        }

        const particles = createParticles(
          imageData,
          rendererChoice.maxParticleCount,
          effectHeight
        );
        const renderer = rendererChoice.create(particles, {
          width: effectWidth,
          height: effectHeight,
          // particles move in device pixels, keep their speed in css pixels
          particleAcceleration: particleAcceleration * scale,
          pixelScale: scale,
          crumble,
          seed,
        });

        this.placeEffectCanvas(elem, renderer.canvas, scale);
        renderer.canvas.dataset['wsThanosRenderer'] = rendererChoice.kind;
        renderer.canvas.dataset['wsThanosCrumble'] = renderer.crumble;
        // when every pixel became a particle, the particles replace the element right away
        const fadeOutMs = particles.sampled
          ? Math.floor(animationLength * 0.8)
          : FULL_COVERAGE_FADE_OUT_MS;
        elem.style.transition = `opacity ${fadeOutMs}ms ease-out`;
        elem.style.opacity = '0';

        const { sound, soundVolume } = options;
        return {
          renderer,
          sound: sound
            ? this.snapSound.play(
                animationLength,
                soundVolume,
                renderer.crumble
              )
            : undefined,
        };
      }),
      switchMap(({ renderer, sound }) => {
        let time = 0;
        let completed = false;
        return interval(1000 / 60, animationFrameScheduler).pipe(
          timeInterval(),
          tap((deltaT) => (time += deltaT.interval)),
          map(
            (deltaT): AnimationState => ({
              deltaTSec: deltaT.interval / 1000,
              animationT: time / animationLength,
              maxWidth: renderer.canvas.width,
              maxHeight: renderer.canvas.height,
            })
          ),
          tap((animationState) => renderer.render(animationState)),
          takeWhile((animationState) => {
            completed = animationState.animationT > 1;
            return !completed;
          }),
          finalize(() => {
            renderer.dispose();
            if (!completed) {
              sound?.stop();
            }
          })
        );
      })
    );
  }

  private placeEffectCanvas(
    elem: HTMLElement,
    canvas: HTMLCanvasElement,
    scale: number
  ): void {
    const { left: offsetLeft, top: offsetTop } = this.offsetInParent(elem);

    const cssHeight = canvas.height / scale;
    // the element sits at the bottom left of the taller effect canvas
    const elemHeight = cssHeight / EFFECT_HEIGHT_SCALE;
    canvas.style.position = 'absolute';
    canvas.style.left = `${offsetLeft}px`;
    canvas.style.top = `${offsetTop - elemHeight * (EFFECT_HEIGHT_SCALE - 1)}px`;
    canvas.style.width = `${canvas.width / scale}px`;
    canvas.style.height = `${cssHeight}px`;
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
