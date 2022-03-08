import {
  Directive,
  ElementRef,
  EventEmitter,
  Inject,
  NgZone,
  OnDestroy,
  Output,
} from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { WS_THANOS_OPTIONS_TOKEN } from './ws-thanos-options.token';
import { WsThanosOptions } from './ws-thanos.options';
import { WsThanosService } from './ws-thanos.service';

@Directive({
  selector: '[wsThanos], ws-thanos',
  exportAs: 'thanos',
})
export class WsThanosDirective implements OnDestroy {
  private subscription?: Subscription;

  @Output()
  private wsThanosComplete: EventEmitter<void> = new EventEmitter<void>();

  constructor(
    private readonly vaporizeDomElem: ElementRef<HTMLElement>,
    private readonly thanosService: WsThanosService,
    @Inject(WS_THANOS_OPTIONS_TOKEN)
    private readonly thanosOptions: WsThanosOptions,
    @Inject(NgZone) private readonly ngZone: NgZone
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
          this.wsThanosComplete.emit();
        });
      },
      error: (error) => {
        console.error('error emitted by vaporize', error);
        this.wsThanosComplete.emit();
      },
    });

    return this.wsThanosComplete.asObservable();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }
}
