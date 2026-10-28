import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
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
    '[style.--mx]': 'glow().x',
    '[style.--my]': 'glow().y',
    '[attr.id]': 'project().id',
    '(pointermove)': 'track($event)',
  },
  templateUrl: './career-project.component.html',
  styleUrl: './career-project.component.scss',
})
export class CareerProjectComponent {
  public readonly project = input.required<CareerProject>();
  /** Open from the start, for the newest engagement. */
  public readonly open = input(false);

  protected readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.texts;
  protected readonly glow = signal({ x: '50%', y: '0%' });

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

  protected track(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.glow.set({
      x: `${((event.clientX - rect.left) / rect.width) * 100}%`,
      y: `${((event.clientY - rect.top) / rect.height) * 100}%`,
    });
  }
}
