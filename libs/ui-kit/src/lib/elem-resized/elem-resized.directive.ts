import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';
import { debounceTime, distinctUntilChanged, Observable, Subject } from 'rxjs';
import { ResizedEvent } from './resized-event';

@Directive({
  standalone: true,
  selector: '[wsSharedUiElemResized]',
})
export class ElemResizedDirective implements AfterViewInit, OnDestroy {
  private readonly elemResizedAction = new Subject<ResizedEvent>();

  @Input() debounceTime = 0;

  @Output()
  readonly wsSharedUiElemResized: Observable<ResizedEvent> = this.elemResizedAction
    .asObservable()
    .pipe(
      debounceTime(this.debounceTime),
      distinctUntilChanged(
        (previous, current) =>
          Math.round(previous.newWidth) === Math.round(current.newWidth) &&
          Math.round(previous.newHeight) === Math.round(current.newHeight)
      )
    );

  private resizeObserver?: ResizeObserver;

  constructor(private readonly element: ElementRef) {}

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
