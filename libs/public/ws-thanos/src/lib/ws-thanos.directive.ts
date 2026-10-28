import {
  Directive,
  ElementRef,
  Output,
  afterNextRender,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable, ReplaySubject, Subject, tap } from 'rxjs';
import { AnimationState } from './animation.state';
import { WS_THANOS_OPTIONS_TOKEN } from './ws-thanos-options.token';
import type { WsThanosOptions } from './ws-thanos.options';
import { WsThanosService } from './ws-thanos.service';

@Directive({
  // Bare prefix is the published public API of @wolsok/thanos; renaming it would be breaking.
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[wsThanos], ws-thanos',
  exportAs: 'thanos',
})
export class WsThanosDirective {
  private wsThanosCompleteSubject = new Subject<void>();
  private untilDestroyed = takeUntilDestroyed();

  /** override the provided options for this element */
  public readonly wsThanosOptions = input<Partial<WsThanosOptions>>();

  @Output()
  public wsThanosComplete: Observable<void> =
    this.wsThanosCompleteSubject.asObservable();

  private readonly vaporizeDomElem: ElementRef<HTMLElement> =
    inject(ElementRef);
  private readonly thanosService: WsThanosService = inject(WsThanosService);
  private readonly thanosOptions: WsThanosOptions = inject(
    WS_THANOS_OPTIONS_TOKEN
  );

  public constructor() {
    // only in the browser, the service runs it once for all elements
    afterNextRender(() => {
      const { preload } = { ...this.thanosOptions, ...this.wsThanosOptions() };
      if (preload) {
        void this.thanosService.preload();
      }
    });
  }

  /**
   *
   * Vaporize the dom element of this directive
   * @param removeElem remove the vaporized dom element or blend back in after a while
   *
   * Subscribe to the returned observable to start vaporization
   *
   */
  public vaporize$(removeElem = true): Observable<AnimationState> {
    const elem = this.vaporizeDomElem.nativeElement;
    return this.thanosService.vaporize(elem, this.wsThanosOptions()).pipe(
      tap({
        error: (error) => {
          console.error('Error vaporizing', error, {
            elemTovaporize: elem,
            removeElem,
          });
        },
      }),
      finalize(() => {
        if (removeElem) {
          elem.remove();
        } else {
          // make visible again
          elem.style.transition = 'opacity 700ms';
          elem.style.opacity = '1';
        }
        this.wsThanosCompleteSubject.next();
      })
    );
  }

  /**
   * Vaporize the dom element of this directive
   * @param removeElem remove the vaporized dom element or blend back in after a while
   * @returns an observable that emits once and completes when the effect is
   * over: after it finished, after it failed (the error is logged and
   * reported as an unhandled RxJS error, as with `vaporize$`) and when the
   * directive was destroyed meanwhile. It replays, so a caller that
   * subscribes after a synchronous failure still gets the completion.
   */
  public vaporize(removeElem = true): Observable<void> {
    const done = new ReplaySubject<void>(1);
    this.vaporize$(removeElem)
      .pipe(
        finalize(() => {
          done.next();
          done.complete();
        }),
        this.untilDestroyed
      )
      .subscribe();
    return done.asObservable();
  }
}
