import {
  AfterViewInit,
  Directive,
  ElementRef,
  OnDestroy,
  Output,
} from '@angular/core';
import ResizeObserver from 'resize-observer-polyfill';
import { distinctUntilChanged, Subject } from 'rxjs';
import { ResizedEvent } from './resized-event';

@Directive({
  selector: '[wsSharedUiElemResized]',
})
export class ElemResizedDirective implements AfterViewInit, OnDestroy {
  private readonly elemResizedAction = new Subject<ResizedEvent>();

  @Output()
  readonly wsSharedUiElemResized = this.elemResizedAction
    .asObservable()
    .pipe(
      distinctUntilChanged(
        (previous, current) =>
          previous.newWidth === current.newWidth &&
          previous.newHeight === current.newHeight
      )
    );

  private resizeObserver?: ResizeObserver;

  constructor(private readonly element: ElementRef) {}

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(
      (resizeEntry: ResizeObserverEntry[], _observer: ResizeObserver) => {
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
