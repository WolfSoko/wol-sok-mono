import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ACHIEVEMENT_XP } from '@wolsok/feat-shared-bacteria-engine';
import { achievementKeys } from '../i18n/game-texts';
import { TranslatePipe } from '../i18n/translate.pipe';
import { LabPassStepId } from './lab-pass';
import { EditorField, LAB_PASS_ACHIEVEMENT, LabPass } from './lab-pass.service';
import { GUEST_IDLE_DAYS } from './guest-visits';
import { SignIn } from './sign-in.service';

/** Where a step of the pass is done, outside the card. */
export type LabPassPage = 'profile' | 'friends';

/** Where a step leads, and the editor's field it opens on. */
const TARGET_OF: Readonly<
  Record<
    Exclude<LabPassStepId, 'sign-in'>,
    { page: LabPassPage; field?: EditorField }
  >
> = {
  profile: { page: 'profile', field: 'name' },
  motto: { page: 'profile', field: 'motto' },
  friend: { page: 'friends' },
};

/** Where each step's cell sits in the dish, around its centre. */
const CELLS: Readonly<Record<LabPassStepId, { x: number; y: number }>> = {
  'sign-in': { x: 14, y: 14 },
  profile: { x: 26, y: 14 },
  motto: { x: 14, y: 26 },
  friend: { x: 26, y: 26 },
};

/**
 * The Lab Pass in the main menu: a dish whose cells fill step by step, the
 * steps, and the next one as the card's button - signing in right here, the
 * rest on the profile or the friends' screen. A guest whose account is due
 * to be deleted reads it here too. Once complete, it tells the player the
 * achievement they earned.
 */
@Component({
  selector: 'feat-lazy-bac-game-lab-pass-card',
  imports: [MatButtonModule, MatIconModule, TranslatePipe],
  template: `
    @let title = titleKey() | t;
    @let achievement = achievementName | t;
    <aside class="banner" [attr.aria-label]="title">
      <svg class="badge dish" viewBox="0 0 40 40" aria-hidden="true">
        <circle class="rim" cx="20" cy="20" r="18" />
        @for (step of pass.steps(); track step.id) {
          <circle
            class="cell"
            [class.done]="step.done"
            [attr.cx]="cells[step.id].x"
            [attr.cy]="cells[step.id].y"
            r="4.5"
          />
        }
      </svg>
      <div class="text">
        <strong class="title">{{ title }}</strong>
        @if (pass.justEarned()) {
          <p class="note">
            {{ 'profile.labPass.earned' | t: { achievement, xp } }}
          </p>
        } @else {
          <p class="note">
            {{
              'profile.labPass.progress'
                | t: { done: pass.done(), total: pass.steps().length }
            }}
            · {{ 'profile.labPass.reward' | t: { achievement } }}
          </p>
          @if (pass.urgent()) {
            <p class="note urgent">
              {{ 'profile.guest.note' | t: { days: idleDays } }}
            </p>
          }
        }
      </div>
      @if (!pass.justEarned()) {
        <ol class="steps">
          @for (step of pass.steps(); track step.id) {
            <li [class.done]="step.done" [class.next]="step.id === pass.next()">
              <mat-icon aria-hidden="true">{{
                step.done ? 'check_circle' : 'radio_button_unchecked'
              }}</mat-icon>
              {{ stepKey(step.id) | t }}
            </li>
          }
        </ol>
      }
      <div class="actions">
        @if (pass.justEarned()) {
          <button
            mat-flat-button
            type="button"
            class="primary"
            (click)="pass.close()"
          >
            {{ 'profile.labPass.close' | t }}
          </button>
        } @else if (pass.next(); as step) {
          <button
            mat-flat-button
            type="button"
            class="go primary"
            [disabled]="step === 'sign-in' && !signIn.ready()"
            [attr.title]="hintKey(step) | t"
            (click)="take(step)"
          >
            <mat-icon>{{
              step === 'sign-in' ? 'login' : 'arrow_forward'
            }}</mat-icon>
            {{ goKey(step) | t }}
          </button>
          <button mat-button type="button" (click)="pass.dismiss()">
            {{ 'profile.guest.later' | t }}
          </button>
        }
      </div>
      @if (signIn.failed()) {
        <span class="failed" role="status">{{ 'social.failed' | t }}</span>
      }
    </aside>
  `,
  styleUrl: './lab-pass-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabPassCardComponent {
  /** To the screen where the next step is done. */
  public readonly open = output<LabPassPage>();

  protected readonly pass = inject(LabPass);
  protected readonly signIn = inject(SignIn);
  protected readonly idleDays = GUEST_IDLE_DAYS;
  protected readonly cells = CELLS;
  protected readonly xp = ACHIEVEMENT_XP;
  protected readonly achievementName =
    achievementKeys(LAB_PASS_ACHIEVEMENT).name;
  /** "Welcome back!" to a guest after a long pause, else the pass's name. */
  protected readonly titleKey = computed(() => {
    if (this.pass.justEarned()) return 'profile.labPass.earnedTitle';
    return this.pass.urgent() && this.pass.cameBack()
      ? 'profile.guest.welcomeBack'
      : 'profile.labPass.title';
  });

  protected stepKey(id: LabPassStepId) {
    return `profile.labPass.steps.${id}` as const;
  }

  protected goKey(id: LabPassStepId) {
    return `profile.labPass.go.${id}` as const;
  }

  protected hintKey(id: LabPassStepId) {
    return `profile.labPass.hints.${id}` as const;
  }

  protected take(step: LabPassStepId): void {
    if (step === 'sign-in') {
      void this.signIn.signIn();
    } else {
      const { page, field } = TARGET_OF[step];
      if (field !== undefined) {
        this.pass.focusEditor(field);
      }
      this.open.emit(page);
    }
  }
}
