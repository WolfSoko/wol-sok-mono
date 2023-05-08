import { Directive, ElementRef, Inject, NgZone, OnDestroy, Output } from '@angular/core';
import { finalize, Observable, Subject, Subscription, take, tap } from 'rxjs';
import { AnimationState } from './animation.state';
import { WS_THANOS_OPTIONS_TOKEN } from './ws-thanos-options.token';
import type { WsThanosOptions } from './ws-thanos.options';
import { WsThanosService } from './ws-thanos.service';

@Directive({
  standalone: true,
  selector: '[wsThanos], ws-thanos',
  exportAs: 'thanos',
})
export class WsThanosDirective implements OnDestroy {
  private wsThanosCompleteSubject: Subject<void> = new Subject<void>();

  @Output()
  public wsThanosComplete: Observable<void> = this.wsThanosCompleteSubject.asObservable();
  private subscriptions: Subscription = new Subscription();

  constructor(
    private readonly vaporizeDomElem: ElementRef<HTMLElement>,
    private readonly thanosService: WsThanosService,
    @Inject(WS_THANOS_OPTIONS_TOKEN)
    private readonly thanosOptions: WsThanosOptions,
    private readonly ngZone: NgZone
  ) {}

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
          console.error('Error vaporizing', error, { elemTovaporize: elem, removeElem });
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
   * @Deprecated use vaporizeAndScrollIntoView$ instead and subscribe to it
   */
  public vaporize(removeElem = true): Observable<void> {
    this.subscriptions.add(this.vaporize$(removeElem).subscribe());
    return this.wsThanosComplete.pipe(take(1));
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}
