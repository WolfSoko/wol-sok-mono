import {
  Directive,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  Renderer2,
  SimpleChange,
  SimpleChanges,
} from '@angular/core';

export interface TypesSimpleChange<T> extends SimpleChange {
  previousValue: T | undefined;
  currentValue: T | undefined;
}

interface ElevateCardChanges extends SimpleChanges {
  raiseLevel: TypesSimpleChange<number>;
}

@Directive({
  standalone: true,
  selector: '[wsSharedUiElevateCard]',
})
export class ElevateCardDirective implements OnChanges {
  private static elevationClass = 'mat-elevation-z';
  private static defaultElevationLevel = 10;

  @Input() elevationLevel!: number;

  constructor(
    private readonly el: ElementRef,
    private readonly renderer: Renderer2
  ) {}

  ngOnChanges(changes: ElevateCardChanges) {
    if (changes.raiseLevel != null) {
      if (changes.raiseLevel.isFirstChange()) {
        this.removeRaiseClass(
          this.getRaiseClass(ElevateCardDirective.defaultElevationLevel)
        );
      } else {
        this.removeRaiseClass(
          this.getRaiseClass(changes.raiseLevel.previousValue)
        );
      }
    }
  }

  @HostListener('touchstart')
  @HostListener('mouseenter')
  raise(): void {
    this.addRaiseClass();
  }

  private addRaiseClass(raiseClass: string = this.getRaiseClass()): void {
    this.renderer.addClass(this.el.nativeElement, raiseClass);
  }

  @HostListener('touchend')
  @HostListener('touchcancel')
  @HostListener('mouseleave')
  unRaise(): void {
    this.removeRaiseClass();
  }

  private removeRaiseClass(raiseClass: string = this.getRaiseClass()): void {
    this.renderer.removeClass(this.el.nativeElement, raiseClass);
  }

  private getRaiseClass(
    raiseLevel: number = this.elevationLevel ??
      ElevateCardDirective.defaultElevationLevel
  ) {
    return ElevateCardDirective.elevationClass + raiseLevel;
  }
}
