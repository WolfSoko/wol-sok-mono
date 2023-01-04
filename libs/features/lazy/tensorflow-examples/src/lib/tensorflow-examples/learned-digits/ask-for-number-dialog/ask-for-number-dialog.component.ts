import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { AskForNumberDialogData } from './ask-for-number-dialog-data';

@Component({
  standalone: true,
  imports: [CommonModule, MatInputModule, FormsModule, MatDialogModule, MatListModule, MatButtonModule],
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
