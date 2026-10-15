import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { PollsRepoPort } from '../../ports/polls-repo.port';

@Component({
  selector: 'rap-create-poll',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './create-poll.component.html',
  styleUrl: './create-poll.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatePollComponent {
  protected readonly minQuestionLength: number =
    PollsRepoPort.MIN_QUESTION_LENGTH;
  protected readonly maxQuestionLength: number =
    PollsRepoPort.MAX_QUESTION_LENGTH;
  protected readonly minOptions: number = PollsRepoPort.MIN_OPTIONS;
  protected readonly maxOptions: number = PollsRepoPort.MAX_OPTIONS;
  protected readonly maxOptionLength: number = PollsRepoPort.MAX_OPTION_LENGTH;

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly pollsRepo = inject(PollsRepoPort);
  private readonly router = inject(Router);

  protected readonly creating = signal(false);
  protected readonly createFailed = signal(false);

  protected readonly form = this.fb.group({
    question: [
      '',
      [
        Validators.required,
        trimmedMinLength(this.minQuestionLength),
        Validators.maxLength(this.maxQuestionLength),
      ],
    ],
    options: this.fb.array([this.createOption(), this.createOption()]),
  });

  protected get options(): FormArray<FormControl<string>> {
    return this.form.controls.options;
  }

  protected addOption(): void {
    if (this.options.length < this.maxOptions) {
      this.options.push(this.createOption());
    }
  }

  protected removeOption(index: number): void {
    if (this.options.length > this.minOptions) {
      this.options.removeAt(index);
    }
  }

  protected async createPoll(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { question, options } = this.form.getRawValue();
    this.creating.set(true);
    this.createFailed.set(false);
    try {
      const pollId = await this.pollsRepo.createPoll({ question, options });
      await this.router.navigate(['/poll', pollId]);
    } catch (error) {
      console.error('Could not create poll', error);
      this.createFailed.set(true);
    } finally {
      this.creating.set(false);
    }
  }

  private createOption(): FormControl<string> {
    return this.fb.control('', [
      Validators.required,
      Validators.pattern(/\S/),
      Validators.maxLength(PollsRepoPort.MAX_OPTION_LENGTH),
    ]);
  }
}

/** Like `Validators.minLength`, but ignores surrounding whitespace, as saving does. */
function trimmedMinLength(minLength: number): ValidatorFn {
  return (control: AbstractControl<string>): ValidationErrors | null => {
    const actualLength = control.value.trim().length;
    return actualLength < minLength
      ? { minlength: { requiredLength: minLength, actualLength } }
      : null;
  };
}
