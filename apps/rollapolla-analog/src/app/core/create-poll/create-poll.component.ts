import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { NewPoll, Poll, PRIVATE_POLL_HINT } from '../../../shared/poll';
import { PollsRepoPort } from '../../ports/polls-repo.port';
import { injectRollaPollaAnalytics } from '../analytics/rollapolla-analytics';
import { CREATED_POLL_ID } from './created-poll-id';

@Component({
  selector: 'rap-create-poll',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './create-poll.component.html',
  styleUrl: './create-poll.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatePollComponent implements OnInit {
  /** Edits this poll instead of creating one; saving resets its votes. */
  public readonly poll = input<Poll>();
  /** Editing finished: saved or cancelled. */
  public readonly editDone = output<void>();

  protected readonly minQuestionLength: number =
    PollsRepoPort.MIN_QUESTION_LENGTH;
  protected readonly maxQuestionLength: number =
    PollsRepoPort.MAX_QUESTION_LENGTH;
  protected readonly minOptions: number = PollsRepoPort.MIN_OPTIONS;
  protected readonly maxOptions: number = PollsRepoPort.MAX_OPTIONS;
  protected readonly maxOptionLength: number = PollsRepoPort.MAX_OPTION_LENGTH;
  protected readonly privatePollHint: string = PRIVATE_POLL_HINT;

  private readonly fb = inject(NonNullableFormBuilder);
  private readonly pollsRepo = inject(PollsRepoPort);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly analytics = injectRollaPollaAnalytics();

  protected readonly saving = signal(false);
  protected readonly saveFailed = signal(false);

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
    /** Public by default; a private poll is found only through its link. */
    listed: [true],
  });

  public ngOnInit(): void {
    const poll = this.poll();
    if (poll) {
      this.options.clear();
      poll.options.forEach(() => this.options.push(this.createOption()));
      this.form.setValue({
        question: poll.question,
        options: poll.options,
        listed: poll.listed,
      });
    }
  }

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

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const newPoll = this.form.getRawValue();
    const poll = this.poll();
    this.saving.set(true);
    this.saveFailed.set(false);
    try {
      if (poll) {
        // applied locally at once; the backend may still refuse it later,
        // which brings back the previous version
        const { saved } = this.pollsRepo.updatePoll(poll.id, newPoll);
        saved.catch((error: unknown) => {
          console.error('Poll changes were rejected', error);
          this.snackBar.open('Could not save your changes to the poll.', 'OK');
        });
        this.analytics.track('poll_edited', pollShape(newPoll));
        this.editDone.emit();
      } else {
        const pollId = await this.pollsRepo.createPoll(newPoll);
        this.analytics.track('poll_created', pollShape(newPoll));
        await this.router.navigate(['/poll', pollId], {
          state: { [CREATED_POLL_ID]: pollId },
        });
      }
    } catch (error) {
      console.error('Could not save poll', error);
      this.saveFailed.set(true);
    } finally {
      this.saving.set(false);
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

/** What analytics learns about a poll: its shape, never its text. */
function pollShape(poll: NewPoll): { options: number; listed: boolean } {
  // unset means unlisted, as the repo stores it
  return { options: poll.options.length, listed: poll.listed ?? false };
}
