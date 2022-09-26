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
export class LetDirective<T = unknown> {
  private context: LetContext<T> = new LetContext<T>();
  private viewRef: EmbeddedViewRef<LetContext<T>> | null = null;

  constructor(
    private readonly viewContainer: ViewContainerRef,
    private readonly templateRef: TemplateRef<LetContext<T>>
  ) {
    this.templateRef = templateRef;
  }

  /**
   * The Boolean expression to evaluate as the condition for showing a template.
   */
  @Input()
  set wsLet(condition: T) {
    this.context.$implicit = condition;
    this.context.wsLet = condition;
    this._updateView();
  }

  private _updateView() {
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
export class LetContext<T = unknown> {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  public $implicit: T = null!;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  public wsLet: T = null!;
}
