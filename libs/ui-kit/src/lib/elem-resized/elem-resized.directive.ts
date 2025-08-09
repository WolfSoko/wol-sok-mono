import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  Output,
  inject,
} from '@angular/core';
import { debounceTime, distinctUntilChanged, Observable, Subject } from 'rxjs';
import { ResizedEvent } from './resized-event';

@Directive({
  selector: '[wsSharedUiElemResized]',
})
export class ElemResizedDirective implements AfterViewInit, OnDestroy {
  private readonly element = inject(ElementRef);

  private readonly elemResizedAction = new Subject<ResizedEvent>();

  @Input() debounceTime = 0;

  @Output()
  readonly wsSharedUiElemResized: Observable<ResizedEvent> =
    this.elemResizedAction.asObservable().pipe(
      debounceTime(this.debounceTime),
      distinctUntilChanged(
        (previous, current) =>
          Math.round(previous.newWidth) === Math.round(current.newWidth) &&
          Math.round(previous.newHeight) === Math.round(current.newHeight)
      )
    );

  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    if (!ResizeObserver) {
      return;
    }
    this.resizeObserver = new ResizeObserver(
      (resizeEntry: ResizeObserverEntry[]) => {
        const resizeObserverEntry: ResizeObserverEntry = resizeEntry[0];
        this.elemResizedAction.next(new ResizedEvent(resizeObserverEntry));
      }
    );
    this.resizeObserver.observe(this.element.nativeElement);
  }

  ngOnDestroy() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }
}
