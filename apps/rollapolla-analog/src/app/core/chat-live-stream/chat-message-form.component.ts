import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'rap-chat-message-form',
  templateUrl: './chat-message-form.component.html',
  styles: `
    :host {
      .form-field {
        width: 100%;
      }
      kbd {
        padding: 0 0.3em;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 4px;
        font: inherit;
      }
      .submit-button-container {
        display: flex;
        justify-content: end;
        padding-top: 0.75rem;
      }
    }
  `,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatIconModule,
    MatButtonModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessageFormComponent implements OnInit {
  private formBuilder = inject(NonNullableFormBuilder);

  minMessageLength = input.required<number>();
  maxMessageLength = input.required<number>();
  messageAdded = output<string>();
  form!: FormGroup<{ newMessage: FormControl<string> }>;

  ngOnInit(): void {
    this.form = this.formBuilder.group({
      newMessage: [
        '',
        {
          validators: [
            Validators.maxLength(this.maxMessageLength()),
            Validators.minLength(this.minMessageLength()),
          ],
        },
      ],
    });
  }

  addMessage() {
    const trimmedNote = this.form.value.newMessage?.trim();
    this.form.patchValue({ newMessage: trimmedNote });

    if (!this.form.value.newMessage || !this.form.valid) {
      this.form.markAllAsTouched();
      return;
    }

    this.messageAdded.emit(this.form.getRawValue().newMessage);
    this.form.reset({ newMessage: '' });
    this.form.markAsUntouched();
    this.form.markAsPristine();
  }
}
