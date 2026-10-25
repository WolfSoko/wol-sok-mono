import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AdminAccessService } from '../access/admin-access.service';
import {
  type AdminCommandInput,
  type AdminResult,
  AdminCommandsService,
} from '../commands/admin-commands.service';
import type { ReplayCommandType } from '../commands/command-types';
import { AdminI18n } from '../i18n/admin-i18n.service';
import {
  CommandDialogComponent,
  type CommandDialogData,
  type CommandDialogResult,
} from './command-dialog.component';

/** A moderation command, before the owner said why. */
export interface ModerationAction extends CommandDialogData {
  type: AdminCommandInput['type'];
  target: Record<string, unknown>;
}

/**
 * Runs a moderation command the way every view does (ADR 0012): asks for
 * the reason in a dialog, sends the command, and tells the result in a
 * snack bar - with "Sign in again" when the rules want a fresher sign-in.
 * Null when the owner cancelled.
 */
@Injectable({ providedIn: 'root' })
export class AdminActionsService {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly commands = inject(AdminCommandsService);
  private readonly access = inject(AdminAccessService);
  private readonly i18n = inject(AdminI18n);

  public async run(action: ModerationAction): Promise<AdminResult | null> {
    const confirmed = await this.confirm(action);
    return confirmed === undefined
      ? null
      : this.send(() =>
          this.commands.send({
            type: action.type,
            target: action.target,
            reason: confirmed.reason,
            args: confirmed.args,
          })
        );
  }

  /** The same for the gallery's curation (`replayCommands`), without a reason. */
  public async runReplay(
    type: ReplayCommandType,
    replayId: string,
    subject: string
  ): Promise<AdminResult | null> {
    const confirmed = await this.confirm({
      type: `replay.${type}`,
      subject,
      reason: false,
    });
    return confirmed === undefined
      ? null
      : this.send(() => this.commands.sendReplay(type, replayId));
  }

  private confirm(
    data: CommandDialogData
  ): Promise<CommandDialogResult | undefined> {
    return firstValueFrom(
      this.dialog
        .open<CommandDialogComponent, CommandDialogData, CommandDialogResult>(
          CommandDialogComponent,
          { data }
        )
        .afterClosed()
    );
  }

  private async send(
    command: () => Promise<AdminResult>
  ): Promise<AdminResult> {
    this.snackBar.open(this.i18n.t('command.sent'));
    let result: AdminResult;
    try {
      result = await command();
    } catch (error) {
      console.error('Could not send the command', error);
      result = { ok: false, error: 'internal' };
    }
    this.tell(result);
    return result;
  }

  private tell(result: AdminResult): void {
    if (result.ok) {
      this.snackBar.open(this.i18n.t('command.done'), undefined, {
        duration: 4000,
      });
      return;
    }
    if (result.error === 'sign-in-again') {
      this.snackBar
        .open(this.i18n.t('command.signInAgain'), this.i18n.t('gate.signIn'))
        .onAction()
        .subscribe(() => void this.access.signIn());
      return;
    }
    this.snackBar.open(
      this.i18n.t('command.failed', { error: result.error ?? 'internal' }),
      undefined,
      { duration: 8000 }
    );
  }
}
