import type { ChooseWaveRendererParams } from './choose-wave-renderer';
import { chooseWaveRenderer } from './choose-wave-renderer';
import { resolveDotColor } from './dot-color';
import type { Rgb, WaveRenderer } from './renderer';

/** stops an observation */
export type Disconnect = () => void;

/** what the loading wave takes from the browser, replaceable in specs */
export interface WaveEnvironment {
  now(): number;
  requestFrame(callback: () => void): number;
  cancelFrame(id: number): void;
  pixelRatio(): number;
  prefersReducedMotion(): boolean;
  createCanvas(): HTMLCanvasElement;
  chooseRenderer(params: ChooseWaveRendererParams): WaveRenderer | null;
  resolveColor(host: HTMLElement, color: string | undefined): Rgb;
  /** calls back when the element's size changed */
  observeSize(element: HTMLElement, onResize: () => void): Disconnect;
  /** calls back when the element enters or leaves the viewport */
  observeVisibility(
    element: HTMLElement,
    onChange: (visible: boolean) => void
  ): Disconnect;
  /** calls back when the page's theme may have changed the colours */
  observeTheme(onChange: () => void): Disconnect;
}

/** sharper than this the dots gain nothing, the GPU only works more */
const MAX_PIXEL_RATIO = 2;

const noop: Disconnect = () => undefined;

/** the real browser, tolerant of the APIs a browser (or jsdom) lacks */
export function browserWaveEnvironment(document: Document): WaveEnvironment {
  const view = document.defaultView;
  const createCanvas = () => document.createElement('canvas');
  return {
    now: () => view?.performance.now() ?? Date.now(),
    requestFrame: (callback) =>
      view?.requestAnimationFrame(() => callback()) ?? 0,
    cancelFrame: (id) => view?.cancelAnimationFrame(id),
    pixelRatio: () => Math.min(MAX_PIXEL_RATIO, view?.devicePixelRatio || 1),
    prefersReducedMotion: () =>
      view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    createCanvas,
    chooseRenderer: chooseWaveRenderer,
    resolveColor: (host, color) => resolveDotColor(host, color, createCanvas),
    observeSize: (element, onResize) => {
      if (view?.ResizeObserver == null) {
        return noop;
      }
      const observer = new view.ResizeObserver(() => onResize());
      observer.observe(element);
      return () => observer.disconnect();
    },
    observeVisibility: (element, onChange) => {
      if (view?.IntersectionObserver == null) {
        return noop;
      }
      const observer = new view.IntersectionObserver((entries) =>
        onChange(entries.some((entry) => entry.isIntersecting))
      );
      observer.observe(element);
      return () => observer.disconnect();
    },
    observeTheme: (onChange) => observeTheme(document, onChange),
  };
}

/** the colour scheme of the system, or a class or attribute on the root */
function observeTheme(document: Document, onChange: () => void): Disconnect {
  const view = document.defaultView;
  const scheme = view?.matchMedia?.('(prefers-color-scheme: dark)');
  scheme?.addEventListener('change', onChange);
  const observer =
    view?.MutationObserver == null
      ? undefined
      : new view.MutationObserver(() => onChange());
  observer?.observe(document.documentElement, { attributes: true });
  if (document.body != null) {
    observer?.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
  }
  return () => {
    scheme?.removeEventListener('change', onChange);
    observer?.disconnect();
  };
}
