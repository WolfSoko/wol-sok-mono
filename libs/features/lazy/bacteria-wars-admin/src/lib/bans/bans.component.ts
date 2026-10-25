import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import type { BanReason } from '@wolsok/feat-lazy-bac-game/admin-kit';
import {
  AdminI18n,
  type AdminTextKey,
  AdminTextPipe,
} from '../i18n/admin-i18n.service';
import { AdminActionsService } from '../moderation/admin-actions.service';
import { type BanRecord, banHolds } from '../moderation/admin-records';
import { AdminRecordsService } from '../moderation/admin-records.service';
import { ListFooterComponent } from '../moderation/list-footer.component';
import { PagedList } from '../moderation/paged-list';

/**
 * The bans (ADR 0012), newest first, each with "Lift ban". Ended bans
 * stay listed until the hourly sweep lifts them.
 */
@Component({
  selector: 'feat-lazy-bac-admin-bans',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminTextPipe,
    ListFooterComponent,
    MatButtonModule,
    MatTableModule,
    RouterLink,
  ],
  template: `
    <table mat-table [dataSource]="list.rows()">
      <ng-container matColumnDef="uid">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'profiles.player' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          <a [routerLink]="['../player', row.uid]">
            <code>{{ row.uid }}</code>
          </a>
        </td>
      </ng-container>
      <ng-container matColumnDef="since">
        <th mat-header-cell *matHeaderCellDef>{{ 'bans.since' | adminT }}</th>
        <td mat-cell *matCellDef="let row">{{ i18n.dateTime(row.since) }}</td>
      </ng-container>
      <ng-container matColumnDef="until">
        <th mat-header-cell *matHeaderCellDef>{{ 'bans.until' | adminT }}</th>
        <td mat-cell *matCellDef="let row">
          @if (row.until === null) {
            {{ 'bans.forGood' | adminT }}
          } @else {
            <span [class.ended]="!holds(row)">
              {{ i18n.dateTime(row.until) }}
            </span>
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="reason">
        <th mat-header-cell *matHeaderCellDef>{{ 'bans.reason' | adminT }}</th>
        <td mat-cell *matCellDef="let row">
          {{ reasonKey(row.reason) | adminT }}
        </td>
      </ng-container>
      <ng-container matColumnDef="actions">
        <th mat-header-cell *matHeaderCellDef></th>
        <td mat-cell *matCellDef="let row">
          <button mat-button type="button" (click)="unban(row)">
            {{ 'type.player.unban' | adminT }}
          </button>
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
    <feat-lazy-bac-admin-list-footer [list]="list" />
  `,
  styles: `
    table {
      width: 100%;
    }
    code {
      font-size: 0.8rem;
      word-break: break-all;
    }
    .ended {
      text-decoration: line-through;
    }
  `,
})
export class BansComponent {
  private readonly records = inject(AdminRecordsService);
  private readonly actions = inject(AdminActionsService);
  protected readonly i18n = inject(AdminI18n);

  protected readonly columns = ['uid', 'since', 'until', 'reason', 'actions'];
  protected readonly list = new PagedList<BanRecord>();

  public constructor() {
    void this.list.load((after) => this.records.bans(after));
  }

  protected holds(ban: BanRecord): boolean {
    return banHolds(ban, Date.now());
  }

  protected reasonKey(reason: BanReason): AdminTextKey {
    return `banReason.${reason}`;
  }

  protected async unban(ban: BanRecord): Promise<void> {
    const result = await this.actions.run({
      type: 'player.unban',
      subject: ban.uid,
      target: { uid: ban.uid },
    });
    if (result?.ok) {
      await this.list.reload();
    }
  }
}
