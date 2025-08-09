import {
  Directive,
  EmbeddedViewRef,
  Input,
  TemplateRef,
  ViewContainerRef,
  inject,
} from '@angular/core';

@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: '[wsLet]',
})
export class LetDirective<T> {
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly templateRef =
    inject<TemplateRef<LetContext<T>>>(TemplateRef);

  private context: LetContext<T> = new LetContext<T>();
  private viewRef: EmbeddedViewRef<LetContext<T>> | null = null;

  constructor() {
    const templateRef = this.templateRef;

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
