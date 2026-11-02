import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { AdminTextPipe } from '../i18n/admin-i18n.service';
import type { PagedList } from './paged-list';

/** Below a list: loading, empty, failed, or "Load more". */
@Component({
  selector: 'feat-lazy-bac-admin-list-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTextPipe, MatButtonModule],
  template: `
    @let paged = list();
    @if (paged.failed()) {
      <p class="error" role="alert">
        {{ 'list.failed' | adminT }}
        <button mat-button type="button" (click)="paged.reload()">
          {{ 'list.reload' | adminT }}
        </button>
      </p>
    } @else if (paged.loading()) {
      <p>{{ 'list.loading' | adminT }}</p>
    } @else if (paged.rows().length === 0) {
      <p>{{ 'list.empty' | adminT }}</p>
    } @else if (paged.hasMore()) {
      <button mat-stroked-button type="button" (click)="paged.more()">
        {{ 'list.more' | adminT }}
      </button>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-block: 1rem;
    }
    .error {
      color: #ff8a80;
    }
  `,
})
export class ListFooterComponent {
  public readonly list = input.required<PagedList<unknown>>();
}
