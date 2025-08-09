import { Directive, ElementRef, NgZone, Output, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable, Subject, Subscription, take, tap } from 'rxjs';
import { AnimationState } from './animation.state';
import { WS_THANOS_OPTIONS_TOKEN } from './ws-thanos-options.token';
import type { WsThanosOptions } from './ws-thanos.options';
import { WsThanosService } from './ws-thanos.service';

@Directive({
  selector: '[wsThanos], ws-thanos',
  exportAs: 'thanos',
})
export class WsThanosDirective {
  private wsThanosCompleteSubject = new Subject<void>();
  private untilDestroyed = takeUntilDestroyed();

  @Output()
  public wsThanosComplete: Observable<void> =
    this.wsThanosCompleteSubject.asObservable();
  private subscriptions: Subscription = new Subscription();

  private readonly vaporizeDomElem: ElementRef<HTMLElement> =
    inject(ElementRef);
  private readonly thanosService: WsThanosService = inject(WsThanosService);
  private readonly thanosOptions: WsThanosOptions = inject(
    WS_THANOS_OPTIONS_TOKEN
  );
  private readonly ngZone: NgZone = inject(NgZone);

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
    return this.thanosService.vaporize(elem).pipe(
      tap({
        error: (error) => {
          console.error('Error vaporizing', error, {
            elemTovaporize: elem,
            removeElem,
          });
        },
      }),
      finalize(() =>
        this.ngZone.run(() => {
          if (removeElem) {
            elem.remove();
          } else {
            // make visible again
            elem.style.transition = 'opacity 700ms';
            elem.style.opacity = '1';
          }
          this.wsThanosCompleteSubject.next();
        })
      )
    );
  }

  /**
   * Vaporize the dom element of this directive
   * @param removeElem remove the vaporized dom element or blend back in after a while
   *
   */
  public vaporize(removeElem = true): Observable<void> {
    this.vaporize$(removeElem).pipe(this.untilDestroyed).subscribe();
    return this.wsThanosComplete.pipe(take(1));
  }
}
