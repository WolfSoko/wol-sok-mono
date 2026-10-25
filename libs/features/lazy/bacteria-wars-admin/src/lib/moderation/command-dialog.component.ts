import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  BAN_REASONS,
  type BanReason,
  REASON_MAX,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import type { OwnerActionType } from '../commands/command-types';
import { AdminTextPipe, type AdminTextKey } from '../i18n/admin-i18n.service';

/** What the dialog asks for, besides the reason every command needs. */
export interface CommandDialogData {
  type: OwnerActionType;
  /** Who or what it is about, shown in the title. */
  subject: string;
  /** Ask for the ban's end and reason. */
  ban?: boolean;
  /** Offer to bar the player from the boards' kind (`args.bar`). */
  bar?: boolean;
  /** False for a command that keeps no reason (`replayCommands`). */
  reason?: false;
}

/** What the owner confirmed: the reason, and the arguments asked for. */
export interface CommandDialogResult {
  reason: string;
  args: Record<string, unknown>;
}

const DAY_MS = 24 * 3_600_000;

/** The ends a ban can have, from now. */
export const BAN_ENDS = [
  { key: 'day', ms: DAY_MS },
  { key: 'week', ms: 7 * DAY_MS },
  { key: 'month', ms: 30 * DAY_MS },
  { key: 'permanent', ms: null },
] as const;

type BanEnd = (typeof BAN_ENDS)[number]['key'];

/**
 * Asks the owner to confirm a command and say why (ADR 0012): every
 * moderation command takes a reason of 1-200 characters, which the audit
 * keeps. A ban also asks for its end and reason, a hide whether to bar.
 */
@Component({
  selector: 'feat-lazy-bac-admin-command-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminTextPipe,
    FormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ typeKey() | adminT }} - {{ data.subject }}</h2>
    <mat-dialog-content class="fields">
      @if (data.ban) {
        <mat-form-field>
          <mat-label>{{ 'dialog.banEnd' | adminT }}</mat-label>
          <mat-select [(ngModel)]="end" name="end">
            @for (option of ends; track option.key) {
              <mat-option [value]="option.key">
                {{ endKey(option.key) | adminT }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ 'dialog.banReason' | adminT }}</mat-label>
          <mat-select [(ngModel)]="banReason" name="banReason">
            @for (reason of banReasons; track reason) {
              <mat-option [value]="reason">
                {{ banReasonKey(reason) | adminT }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>
      }
      @if (data.bar) {
        <mat-slide-toggle [(ngModel)]="bar" name="bar">
          {{ 'dialog.bar' | adminT }}
        </mat-slide-toggle>
      }
      @if (asksReason) {
        <mat-form-field>
          <mat-label>{{ 'dialog.reason' | adminT }}</mat-label>
          <textarea
            matInput
            required
            [maxlength]="max"
            [ngModel]="reason()"
            (ngModelChange)="reason.set($event)"
            name="reason"
          ></textarea>
          <mat-hint align="end">{{ reason().length }} / {{ max }}</mat-hint>
        </mat-form-field>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>
        {{ 'dialog.cancel' | adminT }}
      </button>
      <button
        mat-flat-button
        type="button"
        [disabled]="!valid()"
        (click)="confirm()"
      >
        {{ 'dialog.confirm' | adminT }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .fields {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: min(24rem, 80vw);
    }
  `,
})
export class CommandDialogComponent {
  protected readonly data = inject<CommandDialogData>(MAT_DIALOG_DATA);
  private readonly ref =
    inject<MatDialogRef<CommandDialogComponent, CommandDialogResult>>(
      MatDialogRef
    );

  protected readonly max = REASON_MAX;
  protected readonly ends = BAN_ENDS;
  protected readonly banReasons = BAN_REASONS;
  protected readonly reason = signal('');
  protected readonly asksReason = this.data.reason !== false;
  protected end: BanEnd = 'week';
  protected banReason: BanReason = 'cheating';
  protected bar = false;

  protected readonly valid = computed(() => {
    const reason = this.reason().trim();
    return (
      !this.asksReason || (reason.length > 0 && reason.length <= REASON_MAX)
    );
  });

  protected typeKey(): AdminTextKey {
    return `type.${this.data.type}`;
  }

  protected endKey(end: BanEnd): AdminTextKey {
    return `dialog.end.${end}`;
  }

  protected banReasonKey(reason: BanReason): AdminTextKey {
    return `banReason.${reason}`;
  }

  protected confirm(now: number = Date.now()): void {
    if (!this.valid()) {
      return;
    }
    const args: Record<string, unknown> = {};
    if (this.data.ban) {
      const ms = BAN_ENDS.find((option) => option.key === this.end)?.ms;
      args['until'] = ms === null || ms === undefined ? null : now + ms;
      args['reason'] = this.banReason;
    }
    if (this.data.bar && this.bar) {
      args['bar'] = true;
    }
    this.ref.close({ reason: this.reason().trim(), args });
  }
}
