import {
  Directive,
  EmbeddedViewRef,
  Input,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[wsLet]',
  standalone: true,
})
export class LetDirective<T> {
  private context: LetContext<T> = new LetContext<T>();
  private viewRef: EmbeddedViewRef<LetContext<T>> | null = null;

  constructor(
    private readonly viewContainer: ViewContainerRef,
    private readonly templateRef: TemplateRef<LetContext<T>>
  ) {
    this.templateRef = templateRef;
  }

  @Input()
  set wsLet(input: T) {
    this.context.$implicit = input;
    this.context.wsLet = input;
    this.updateView();
  }

  private updateView() {
    if (this.viewRef) {
      return;
    }
    this.viewContainer.clear();

    if (!this.templateRef) {
      return;
    }

    this.viewRef = this.viewContainer.createEmbeddedView(
      this.templateRef,
      this.context
    );
  }
}

/**
 * @publicApi
 */
export class LetContext<T> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  public $implicit: T = null!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  public wsLet: T = null!;
}
