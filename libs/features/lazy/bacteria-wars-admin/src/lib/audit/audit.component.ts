import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  ADMIN_COMMAND_TYPES,
  type AdminCommandType,
  isUid,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import { type AdminTextKey, AdminTextPipe } from '../i18n/admin-i18n.service';
import type { AuditRecord } from '../moderation/admin-records';
import {
  AdminRecordsService,
  type AuditFilter,
} from '../moderation/admin-records.service';
import { ListFooterComponent } from '../moderation/list-footer.component';
import { PagedList } from '../moderation/paged-list';
import { AuditTableComponent } from './audit-table.component';

/**
 * The audit (ADR 0012): everything the owner and the functions did,
 * newest first - all of it, one command type, or one player.
 */
@Component({
  selector: 'feat-lazy-bac-admin-audit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminTextPipe,
    AuditTableComponent,
    FormsModule,
    ListFooterComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
    <form class="filters" (ngSubmit)="apply()">
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>{{ 'audit.filter' | adminT }}</mat-label>
        <mat-select [(ngModel)]="by" name="by">
          <mat-option value="all">{{ 'audit.all' | adminT }}</mat-option>
          <mat-option value="type">{{ 'audit.byType' | adminT }}</mat-option>
          <mat-option value="uid">{{ 'audit.byUid' | adminT }}</mat-option>
        </mat-select>
      </mat-form-field>
      @if (by === 'type') {
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>{{ 'audit.type' | adminT }}</mat-label>
          <mat-select [(ngModel)]="type" name="type">
            @for (option of types; track option) {
              <mat-option [value]="option">
                {{ typeKey(option) | adminT }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      @if (by === 'uid') {
        <mat-form-field subscriptSizing="dynamic">
          <mat-label>{{ 'audit.uid' | adminT }}</mat-label>
          <input matInput name="uid" [(ngModel)]="uid" />
        </mat-form-field>
      }
      <button mat-stroked-button type="submit" [disabled]="!valid()">
        {{ 'audit.apply' | adminT }}
      </button>
    </form>
    <feat-lazy-bac-admin-audit-table [rows]="list.rows()" />
    <feat-lazy-bac-admin-list-footer [list]="list" />
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      align-items: center;
      margin-bottom: 1rem;
    }
  `,
})
export class AuditComponent {
  private readonly records = inject(AdminRecordsService);

  protected readonly types = ADMIN_COMMAND_TYPES;
  protected readonly list = new PagedList<AuditRecord>();
  protected by: AuditFilter['by'] = 'all';
  protected type: AdminCommandType = 'player.ban';
  protected uid = '';

  public constructor() {
    this.load({ by: 'all' });
  }

  protected typeKey(type: AdminCommandType): AdminTextKey {
    return `type.${type}`;
  }

  protected valid(): boolean {
    return this.by !== 'uid' || isUid(this.uid.trim());
  }

  protected apply(): void {
    if (!this.valid()) {
      return;
    }
    this.load(
      this.by === 'type'
        ? { by: 'type', type: this.type }
        : this.by === 'uid'
          ? { by: 'uid', uid: this.uid.trim() }
          : { by: 'all' }
    );
  }

  private load(filter: AuditFilter): void {
    void this.list.load((after) => this.records.audit(filter, after));
  }
}
