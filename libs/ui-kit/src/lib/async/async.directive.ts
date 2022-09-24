/* eslint-disable @angular-eslint/no-input-rename */
import { Directive, Input, OnChanges, OnDestroy, TemplateRef, ViewContainerRef } from "@angular/core";
import { Observable, Subscription } from "rxjs";

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[ngAsync]',
  standalone: true,
})
export class AsyncDirective<T> implements OnChanges, OnDestroy {
  @Input('ngAsyncFrom')
  source?: Observable<T>;

  private index = 0;
  private subscription?: Subscription;

  constructor(
    private readonly tempRef: TemplateRef<{ $implicit: T; index: number }>,
    private readonly vcRef: ViewContainerRef
  ) {}

  private projectValue(value: T): void {
    this.vcRef.clear();

    this.vcRef.createEmbeddedView(this.tempRef, {
      $implicit: value,
      index: this.index++,
    });
  }

  ngOnChanges() {
    this.ngOnDestroy();
    this.index = 0;
    this.subscription?.unsubscribe();
    this.subscription = this.source?.subscribe((value) =>
      this.projectValue(value)
    );
  }

  ngOnDestroy() {
    this.subscription?.unsubscribe();
  }
}
