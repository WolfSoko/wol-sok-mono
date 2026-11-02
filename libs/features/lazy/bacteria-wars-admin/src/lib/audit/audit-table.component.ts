import { JsonPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { isOwnerActionType } from '../commands/command-types';
import { AdminI18n, AdminTextPipe } from '../i18n/admin-i18n.service';
import type { AuditRecord } from '../moderation/admin-records';

/**
 * Audit entries (ADR 0012), newest first: when, which command, on whom,
 * why and how it went - with what it changed folded away.
 */
@Component({
  selector: 'feat-lazy-bac-admin-audit-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AdminTextPipe, JsonPipe, MatTableModule, RouterLink],
  template: `
    <table mat-table [dataSource]="rows()">
      <ng-container matColumnDef="at">
        <th mat-header-cell *matHeaderCellDef>{{ 'audit.at' | adminT }}</th>
        <td mat-cell *matCellDef="let row">
          {{ row.at === null ? '' : i18n.dateTime(row.at) }}
          @if (row.by === 'system') {
            <br /><small>{{ 'audit.system' | adminT }}</small>
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="type">
        <th mat-header-cell *matHeaderCellDef>{{ 'audit.type' | adminT }}</th>
        <td mat-cell *matCellDef="let row">{{ typeName(row.type) }}</td>
      </ng-container>
      <ng-container matColumnDef="target">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'audit.target' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          @if (row.uid !== null) {
            <a [routerLink]="['/admin/player', row.uid]">
              <code>{{ row.uid }}</code>
            </a>
          }
          @if (row.replayId !== null) {
            <small>{{ 'replays.replay' | adminT }} {{ row.replayId }}</small>
          }
          @if (row.entry !== null) {
            <br /><small
              >{{ row.entry.boardId }} / {{ row.entry.entryId }}</small
            >
          }
        </td>
      </ng-container>
      <ng-container matColumnDef="reason">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'audit.reason' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">{{ row.reason }}</td>
      </ng-container>
      <ng-container matColumnDef="result">
        <th mat-header-cell *matHeaderCellDef>
          {{ 'audit.result' | adminT }}
        </th>
        <td mat-cell *matCellDef="let row">
          @if (row.ok === null) {
            {{ 'audit.running' | adminT }}
          } @else if (row.ok) {
            {{ 'audit.ok' | adminT }}
          } @else {
            <span class="error">{{ row.error ?? 'internal' }}</span>
          }
          @if (row.before !== null || row.after !== null) {
            <details>
              <summary>{{ 'audit.details' | adminT }}</summary>
              <pre>{{ row.before | json }}</pre>
              <pre>{{ row.after | json }}</pre>
            </details>
          }
        </td>
      </ng-container>
      <tr mat-header-row *matHeaderRowDef="columns"></tr>
      <tr mat-row *matRowDef="let row; columns: columns"></tr>
    </table>
  `,
  styles: `
    table {
      width: 100%;
    }
    code {
      font-size: 0.8rem;
      word-break: break-all;
    }
    .error {
      color: #ff8a80;
    }
    pre {
      max-width: 24rem;
      max-height: 16rem;
      overflow: auto;
      font-size: 0.75rem;
    }
  `,
})
export class AuditTableComponent {
  protected readonly i18n = inject(AdminI18n);
  public readonly rows = input.required<readonly AuditRecord[]>();
  protected readonly columns = ['at', 'type', 'target', 'reason', 'result'];

  /** A command type's name, the stored id for anything else. */
  protected typeName(type: string): string {
    return isOwnerActionType(type) ? this.i18n.t(`type.${type}`) : type;
  }
}
