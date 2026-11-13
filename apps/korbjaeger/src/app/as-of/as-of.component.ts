import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import type { AsOf } from '../basketball-data/as-of';
import { NOW } from '../now';
import { asOfAge, asOfReasonText, asOfTime } from './as-of-text';

/**
 * Where a screen shows a read's last good data (`asOf`, from the read's
 * resource): why, and how old it is ("Offline · Stand: vor 2 Std."),
 * aging with `NOW`. Nothing for data just read.
 */
@Component({
  selector: 'korb-as-of',
  imports: [MatIconModule],
  template: `
    @if (display(); as shown) {
      <p class="as-of" data-qa="as-of">
        <mat-icon aria-hidden="true">cloud_off</mat-icon>
        <span
          >{{ shown.reason }} ·
          <time [attr.datetime]="shown.iso" [title]="shown.time">{{
            age()
          }}</time></span
        >
      </p>
    }
  `,
  styles: `
    .as-of {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin: 0.5rem 0;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsOfComponent {
  /** The read's last good data it shows, `undefined` while it is fresh. */
  public readonly asOf = input.required<AsOf | undefined>();

  private readonly now = inject(NOW);

  /** What stays with the Stand: why, and when its data came. */
  protected readonly display = computed(() => {
    const asOf = this.asOf();
    return asOf === undefined
      ? undefined
      : {
          reason: asOfReasonText(asOf.reason),
          time: asOfTime(asOf.storedAt),
          iso: new Date(asOf.storedAt).toISOString(),
        };
  });

  /** How old its data is: the one part that moves with the clock. */
  protected readonly age = computed(() => {
    const asOf = this.asOf();
    return asOf === undefined ? '' : asOfAge(asOf.storedAt, this.now());
  });
}
