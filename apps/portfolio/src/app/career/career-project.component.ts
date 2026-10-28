import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  OnDestroy,
} from '@angular/core';
import { I18nService } from '../i18n/i18n.service';
import { CareerProject } from './career.model';

/**
 * One engagement on the timeline: a card that opens for the details, with
 * a glow that follows the pointer.
 */
@Component({
  selector: 'wolsok-career-project',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--accent]': 'project().accent',
    '[attr.id]': 'project().id',
  },
  templateUrl: './career-project.component.html',
  styleUrl: './career-project.component.scss',
})
export class CareerProjectComponent implements OnDestroy {
  public readonly project = input.required<CareerProject>();
  /** Open from the start, for the newest engagement. */
  public readonly open = input(false);

  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;

  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private rect: DOMRect | null = null;
  private readonly onEnter = (): void => {
    this.rect = this.element.nativeElement.getBoundingClientRect();
  };
  private readonly onMove = (event: PointerEvent): void => {
    const rect =
      this.rect ?? this.element.nativeElement.getBoundingClientRect();
    const { style } = this.element.nativeElement;
    style.setProperty(
      '--mx',
      `${((event.clientX - rect.left) / rect.width) * 100}%`
    );
    style.setProperty(
      '--my',
      `${((event.clientY - rect.top) / rect.height) * 100}%`
    );
  };

  protected readonly period = computed(() => {
    const { from, to } = this.project();
    return from === to ? `${from}` : `${from} – ${to}`;
  });

  protected readonly duration = computed(() => {
    const months = this.project().durationMonths;
    return months
      ? this.i18n.fill(this.t().career.months, { count: months })
      : null;
  });

  public constructor() {
    // The glow is written straight to the style, with listeners added by
    // hand: a template listener would mark the view dirty on every move.
    afterNextRender(() => {
      const element = this.element.nativeElement;
      element.addEventListener('pointerenter', this.onEnter, { passive: true });
      element.addEventListener('pointermove', this.onMove, { passive: true });
    });
  }

  public ngOnDestroy(): void {
    const element = this.element.nativeElement;
    element.removeEventListener('pointerenter', this.onEnter);
    element.removeEventListener('pointermove', this.onMove);
  }
}
