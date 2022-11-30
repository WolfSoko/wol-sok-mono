import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import {
  MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA,
  MatLegacyDialogModule as MatDialogModule,
  MatLegacyDialogRef as MatDialogRef,
} from '@angular/material/legacy-dialog';
import { MatLegacyInputModule as MatInputModule } from '@angular/material/legacy-input';
import { MatLegacyListModule as MatListModule } from '@angular/material/legacy-list';
import { AskForNumberDialogData } from './ask-for-number-dialog-data';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    MatInputModule,
    FormsModule,
    MatDialogModule,
    MatListModule,
    MatButtonModule,
  ],
  selector: 'feat-lazy-tensor-app-ask-for-number-dialog',
  templateUrl: './ask-for-number-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AskForNumberDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<AskForNumberDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AskForNumberDialogData
  ) {}

  onNoClick(): void {
    this.dialogRef.close();
  }
}
