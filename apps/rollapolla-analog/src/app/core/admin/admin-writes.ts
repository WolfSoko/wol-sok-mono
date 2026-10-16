import { inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { WriteReceipt } from '../../ports/polls-repo.port';
import {
  ConfirmData,
  ConfirmDialogComponent,
} from './confirm-dialog.component';

/**
 * Confirms admin actions and reports writes the backend refused. Create it
 * in an injection context.
 */
export class AdminWrites {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  public async confirm(data: ConfirmData): Promise<boolean> {
    const confirmed = await firstValueFrom(
      this.dialog
        .open<ConfirmDialogComponent, ConfirmData, boolean>(
          ConfirmDialogComponent,
          { data }
        )
        .afterClosed()
    );
    return confirmed === true;
  }

  /**
   * Asks first, then writes. Resolves `true` once the backend accepted it,
   * `false` if the admin cancelled or the write was refused.
   */
  public async confirmed(
    data: ConfirmData,
    write: () => WriteReceipt,
    failure: string
  ): Promise<boolean> {
    return (await this.confirm(data)) && this.saved(write(), failure);
  }

  /** Resolves `false` and tells the admin if the write was refused. */
  public async saved(write: WriteReceipt, failure: string): Promise<boolean> {
    try {
      await write.saved;
      return true;
    } catch (error) {
      console.error(failure, error);
      this.snackBar.open(failure, 'OK', { duration: 6000 });
      return false;
    }
  }
}
