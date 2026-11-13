import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { firstValueFrom } from 'rxjs';
import { SELECTION } from '../selection/selection';
import type { Child, MarkablePlayer } from '@wolsok/feat-korbjaeger-selection';
import { selectionChange } from '../errors/selection-change';
import { CHILD_CHANGE } from './child-change';
import {
  NicknameDialogComponent,
  type NicknameAnswer,
  type NicknameQuestion,
} from './nickname-dialog.component';

/**
 * Marks a named player of a followed Team's Kader as the Elternteil's
 * Kind, asking for an optional Spitzname first; a marked one offers to
 * change its Spitzname or to take the mark away. Takes only a
 * `MarkablePlayer`, so an Anonymer Spieler gets none. A failed change
 * shows on the page where it provides `CHILD_CHANGE`, which outlives
 * the control, else in the control itself; a
 * dialog still open when the control goes (the Team unfollowed in another
 * tab) is closed, and changes nothing.
 */
@Component({
  selector: 'korb-child-mark',
  imports: [MatButtonModule, MatIconModule, MatMenuModule],
  template: `
    @if (child()) {
      <button
        matIconButton
        type="button"
        data-qa="child-menu"
        [matMenuTriggerFor]="menue"
        [attr.aria-label]="'Mein Kind ' + name() + ': Markierung ändern'"
      >
        <mat-icon aria-hidden="true">more_vert</mat-icon>
      </button>
      <mat-menu #menue="matMenu">
        <button mat-menu-item type="button" (click)="changeNickname()">
          <mat-icon aria-hidden="true">edit</mat-icon>
          Spitzname ändern
        </button>
        <button mat-menu-item type="button" (click)="unmark()">
          <mat-icon aria-hidden="true">star_outline</mat-icon>
          Markierung entfernen
        </button>
      </mat-menu>
    } @else {
      <button
        matIconButton
        type="button"
        data-qa="child-mark"
        aria-label="Als mein Kind markieren"
        title="Als mein Kind markieren"
        (click)="mark()"
      >
        <mat-icon aria-hidden="true">star_outline</mat-icon>
      </button>
    }
    @if (ownError?.(); as text) {
      <p class="error" role="alert">{{ text }}</p>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
    }
    .error {
      margin: 0;
      white-space: normal;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChildMarkComponent {
  public readonly player = input.required<MarkablePlayer>();
  /** The player's name as the Kader shows it, for the labels and the dialog. */
  public readonly name = input.required<string>();
  /** The player as a marked Kind; none while unmarked. */
  public readonly child = input<Child>();

  private readonly selection = inject(SELECTION);
  private readonly dialog = inject(MatDialog);

  private readonly pageChange = inject(CHILD_CHANGE, { optional: true });
  private readonly change = this.pageChange ?? selectionChange();
  /** The failures it shows itself: where no page does (`CHILD_CHANGE`). */
  protected readonly ownError = this.pageChange ? undefined : this.change.error;
  /** The dialog open now, closed with the control. */
  private openDialog?: MatDialogRef<NicknameDialogComponent, NicknameAnswer>;
  private destroyed = false;

  public constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.openDialog?.close();
    });
  }

  protected async mark(): Promise<void> {
    const answer = await this.ask({
      name: this.name(),
      action: 'mark',
    });
    if (answer) {
      const player = this.player();
      await this.change.run(() => this.selection.mark(player, answer.nickname));
    }
  }

  protected async changeNickname(): Promise<void> {
    const answer = await this.ask({
      name: this.name(),
      nickname: this.child()?.nickname,
      action: 'change',
    });
    if (answer) {
      const personId = this.player().personId;
      await this.change.run(() =>
        this.selection.setNickname(personId, answer.nickname)
      );
    }
  }

  protected unmark(): Promise<boolean> {
    const personId = this.player().personId;
    return this.change.run(() => this.selection.unmark(personId));
  }

  /**
   * Opens the dialog; its answer, or none where it was cancelled or the
   * control went meanwhile.
   */
  private async ask(
    question: NicknameQuestion
  ): Promise<NicknameAnswer | undefined> {
    const dialog = this.dialog.open<
      NicknameDialogComponent,
      NicknameQuestion,
      NicknameAnswer
    >(NicknameDialogComponent, { data: question });
    this.openDialog = dialog;
    const answer = await firstValueFrom(dialog.afterClosed());
    this.openDialog = undefined;
    return this.destroyed ? undefined : answer;
  }
}
