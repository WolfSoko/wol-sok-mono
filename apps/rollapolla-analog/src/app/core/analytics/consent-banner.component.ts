import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_SNACK_BAR_DATA,
  MatSnackBarAction,
  MatSnackBarActions,
  MatSnackBarLabel,
  MatSnackBarRef,
} from '@angular/material/snack-bar';
import type { ConsentChoice } from './analytics-consent';

export interface ConsentBannerData {
  decide(choice: ConsentChoice): void;
}

@Component({
  selector: 'rap-consent-banner',
  imports: [
    MatButtonModule,
    MatSnackBarAction,
    MatSnackBarActions,
    MatSnackBarLabel,
  ],
  template: `
    <span matSnackBarLabel data-testid="consent-banner">
      May RollaPolla count your visit with Google Analytics? No ads, no ad
      tracking.
    </span>
    <span matSnackBarActions>
      <button
        mat-button
        matSnackBarAction
        data-testid="consent-decline"
        (click)="decide('denied')"
      >
        Decline
      </button>
      <button
        mat-button
        matSnackBarAction
        data-testid="consent-accept"
        (click)="decide('granted')"
      >
        Accept
      </button>
    </span>
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
    }
    [matSnackBarLabel] {
      flex: 1 1 16rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsentBannerComponent {
  private readonly data = inject<ConsentBannerData>(MAT_SNACK_BAR_DATA);
  private readonly snackBarRef = inject(MatSnackBarRef);

  protected decide(choice: ConsentChoice): void {
    this.data.decide(choice);
    this.snackBarRef.dismiss();
  }
}
