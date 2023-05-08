import { Directive, ElementRef, EventEmitter, Inject, NgZone, OnDestroy, Output } from '@angular/core';
import { Observable, Subject, Subscription, take } from 'rxjs';
import { WS_THANOS_OPTIONS_TOKEN } from './ws-thanos-options.token';
import type { WsThanosOptions } from './ws-thanos.options';
import { WsThanosService } from './ws-thanos.service';

@Directive({
  standalone: true,
  selector: '[wsThanos], ws-thanos',
  exportAs: 'thanos',
})
export class WsThanosDirective implements OnDestroy {
  private subscription?: Subscription;
  private wsThanosCompleteSubject: Subject<void> = new Subject<void>();

  @Output()
  public wsThanosComplete: Observable<void> = this.wsThanosCompleteSubject.asObservable();

  constructor(
    private readonly vaporizeDomElem: ElementRef<HTMLElement>,
    private readonly thanosService: WsThanosService,
    @Inject(WS_THANOS_OPTIONS_TOKEN)
    private readonly thanosOptions: WsThanosOptions,
    private readonly ngZone: NgZone
  ) {}

  public vaporize(removeElem = true): Observable<void> {
    const elem = this.vaporizeDomElem.nativeElement;
    this.subscription = this.thanosService.vaporize(elem).subscribe({
      complete: () => {
        this.ngZone.run(() => {
          if (removeElem) {
            elem.remove();
          } else {
            // make visible again
            elem.style.transition = 'opacity 700ms';
            elem.style.opacity = '1';
          }
          this.wsThanosCompleteSubject.next();
        });
      },
      error: (error) => {
        this.wsThanosCompleteSubject.next();
      },
    });

    return this.wsThanosComplete.pipe(take(1));
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
