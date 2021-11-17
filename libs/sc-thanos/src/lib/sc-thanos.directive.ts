import { Directive, ElementRef, EventEmitter, Inject, NgZone, OnDestroy, Output } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { SC_THANOS_OPTIONS_TOKEN, ScThanosOptions } from './sc-thanos.options';
import { ScThanosService } from './sc-thanos.service';

@Directive({
  selector: 'sc-thanos, [scThanos]',
  exportAs: 'thanos'
})
export class ScThanosDirective implements OnDestroy {

  private subscription?: Subscription;

  @Output()
  private scThanosComplete: EventEmitter<void> = new EventEmitter<void>();

  constructor(private readonly vaporizeDomElem: ElementRef<HTMLElement>,
              private readonly thanosService: ScThanosService,
              @Inject(SC_THANOS_OPTIONS_TOKEN) private readonly thanosOptions: ScThanosOptions,
              @Inject(NgZone) private readonly ngZone: NgZone) {
  }

  public vaporize(removeElem = true): Observable<void> {
    const elem = this.vaporizeDomElem.nativeElement;
    this.subscription = this.thanosService.vaporize(elem)
      .subscribe({
        complete: () => {
          this.ngZone.run(() => {
            if (removeElem) {
              elem.remove();
            } else {
              // make visible again
              elem.style.transition = 'opacity 700ms';
              elem.style.opacity = '1';
            }
            this.scThanosComplete.emit();
          });
        },
        error: (error) => {
          console.error('error emitted by vaporize', error);
          this.scThanosComplete.emit();
        }
      });

    return this.scThanosComplete.asObservable();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

}
