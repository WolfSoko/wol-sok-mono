import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  inject,
  Injectable,
  Injector,
  signal,
} from '@angular/core';
import {
  exitFullscreen,
  fullscreenElementOf,
  isFullscreen,
  isFullscreenSupported,
  lockLandscape,
  requestFullscreen,
  unlockOrientation,
} from '../fullscreen';

/**
 * The stage's fullscreen: its own layout over the whole viewport, and the
 * browser's Fullscreen API on top where there is one. Provided by the stage
 * component, which hands it its element with {@link bind}.
 */
@Injectable()
export class StageFullscreen {
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  /** The stage element - none before {@link bind}, or without a template. */
  private stage: () => HTMLElement | undefined = () => undefined;

  /**
   * True while the stage is laid over the whole viewport rather than
   * embedded in the page; it looks the same either way. A touch device opens
   * this way - a phone between two players has no room for a page around the
   * game.
   *
   * This is the component's own layout and works everywhere. On top of it the
   * browser's Fullscreen API is used where it exists, to hide the browser
   * chrome as well - see {@link requestNative}.
   */
  public readonly fullscreen = signal(isTouchDevice());
  /** True while the browser shows the stage on the whole screen. */
  public readonly nativeFullscreen = signal(false);
  /** False where the browser has no Fullscreen API, as on iPhones. */
  public readonly nativeFullscreenSupported = signal(false);
  /**
   * How far below the top of the page the embedded stage starts, in CSS
   * pixels: it fills the viewport from there - see {@link measureStageTop}.
   */
  public readonly stageTop = signal(0);

  /** Takes the stage element, read anew on every use. */
  public bind(stage: () => HTMLElement | undefined): void {
    this.stage = stage;
  }

  /**
   * Once the stage is rendered: finds out whether the browser can put it on
   * the screen, measures where it starts, and asks for the screen if the
   * navigation that opened the page left a gesture to spend.
   */
  public open(): void {
    this.nativeFullscreenSupported.set(
      isFullscreenSupported(this.document, this.stage())
    );
    this.measureStageTop();
    this.requestNativeOnOpen();
  }

  /**
   * Measures where the embedded stage starts on the page - below the shell's
   * toolbar, or right at the top on the game's own site - so that it fills
   * the rest of the viewport. Laid over the viewport it keeps the last value.
   */
  public measureStageTop(): void {
    const stage = this.stage();
    if (this.fullscreen() || stage == null) {
      return;
    }
    const top = stage.getBoundingClientRect().top + window.scrollY;
    this.stageTop.set(Math.max(0, Math.round(top)));
  }

  /** The fullscreen buttons: onto the whole viewport, or back into the page. */
  public set(on: boolean): void {
    if (on) {
      this.enter();
    } else {
      this.leave();
    }
  }

  /**
   * Lays the stage over the whole viewport and asks the browser for its
   * fullscreen on top. Called from a gesture - a button or the F key -
   * where the browser grants the request.
   */
  public enter(): void {
    this.fullscreen.set(true);
    this.requestNative();
  }

  /** Brings the stage back into the page. */
  public leave(): void {
    this.fullscreen.set(false);
    exitFullscreen(this.document);
    afterNextRender(() => this.measureStageTop(), { injector: this.injector });
  }

  /** Puts the stage on the browser's whole screen, or takes it off again. */
  public setNative(on: boolean): void {
    if (on) {
      this.requestNative();
    } else {
      exitFullscreen(this.document);
    }
  }

  /**
   * Asks the browser to put the stage on the whole screen, once a request
   * stands a chance: only while the layout is up, not without the API, and
   * not while the stage is on the screen already. A refusal costs nothing -
   * the next gesture asks again.
   */
  public requestNative(): void {
    const stage = this.stage();
    if (
      !this.fullscreen() ||
      !isFullscreenSupported(this.document, stage) ||
      this.isNative()
    ) {
      return;
    }
    void requestFullscreen(stage);
  }

  /**
   * Follows the browser's fullscreen both ways, and tells whether it just
   * took the screen off the stage - the stage then reacts as it does to
   * Escape, which the browser consumes before the game sees it.
   *
   * Once it puts the stage on the screen, the layout is up as well: a
   * request granted late, after the layout was left, must not leave a bare
   * stage on the screen. Native fullscreen also locks a phone into
   * landscape, where the arena and the two seats fit.
   *
   * The event tells of every element in the document. The replay viewer on
   * the 'replay' screen takes the screen for its own element, a descendant
   * of the stage: that changes nothing about the stage's standing (it keeps
   * its fullscreen underneath), so such an event is let pass. And the screen
   * going away afterwards - the viewer closed while fullscreen, say, with
   * the menu already up - took nothing off the stage: only a screen the
   * stage itself held (`nativeFullscreen` before this change) counts as
   * taken off. The orientation lock goes either way, since no element holds
   * the screen any more.
   */
  public followBrowser(): boolean {
    const stage = this.stage();
    const current = fullscreenElementOf(this.document) ?? null;
    if (
      current != null &&
      stage != null &&
      current !== stage &&
      stage.contains(current)
    ) {
      return false;
    }
    const wasStage = this.nativeFullscreen();
    const native = current != null && (stage == null || current === stage);
    this.nativeFullscreen.set(native);
    if (native) {
      this.fullscreen.set(true);
      void lockLandscape(screen);
      return false;
    }
    unlockOrientation(screen);
    return wasStage;
  }

  /** Gives the screen back as the stage goes. */
  public release(): void {
    exitFullscreen(this.document);
    unlockOrientation(screen);
  }

  /**
   * The page opens in the layout already (see {@link fullscreen}); this asks
   * for the browser's fullscreen on top. Without a gesture to spend the
   * browser would refuse and log an error, so the request is only made while
   * one is still fresh - after a navigation started by a click - and otherwise
   * left to the next gesture the game owns: Start, resume, F or the button.
   */
  private requestNativeOnOpen(): void {
    if (navigator.userActivation?.isActive) {
      this.requestNative();
    }
  }

  /** True while the browser shows the stage, and nothing else, on the screen. */
  private isNative(): boolean {
    return isFullscreen(this.document, this.stage());
  }
}

/** True on a device driven by touch, which opens the game fullscreen. */
function isTouchDevice(): boolean {
  return (
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  );
}
