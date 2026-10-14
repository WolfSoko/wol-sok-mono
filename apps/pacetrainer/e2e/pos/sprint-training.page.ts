import { expect, Locator, Page } from '@playwright/test';
import {
  seconds,
  Seconds,
} from '../../src/app/shared/model/constants/time-utils';

export class SprintTrainingPage {
  readonly page: Page;

  readonly overview: Locator;
  readonly sprintTraining: Locator;
  readonly toggleTrainingCta: Locator;
  readonly stopTrainingCta: Locator;
  readonly zusammenfassung: Locator;
  private countdownTimer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.overview = page.getByTestId('training-overview');
    this.sprintTraining = page.getByTestId('sprint-training');
    this.toggleTrainingCta = this.sprintTraining.getByTestId('toggle-training');
    this.stopTrainingCta = this.sprintTraining.getByTestId('stop-training');
    this.countdownTimer = this.sprintTraining.getByTestId('countdown-timer');
    this.zusammenfassung = this.sprintTraining.getByTestId('zusammenfassung');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async expectTitleVisible(): Promise<void> {
    await expect(
      this.sprintTraining.getByText('Sprint Training')
    ).toBeVisible();
  }

  async expectSprintTrainingConfigurationNotVisible(): Promise<void> {
    await expect(
      this.sprintTraining.getByTestId('sprint-form')
    ).not.toBeVisible({ timeout: 10000 });
    await expect(this.overview.getByText('Wiederholungen')).toBeHidden();
  }

  async expectSprintTrainingConfiguration(
    { repetitions, sprintTime, recoveryTime, totalTime } = {
      repetitions: 4,
      recoveryTime: seconds(60),
      sprintTime: seconds(10),
      totalTime: seconds(280),
    }
  ): Promise<void> {
    await expect(
      this.overview.getByText(`${repetitions} Wiederholungen`)
    ).toBeVisible();
    await expect(
      this.overview.getByText(`${this.formatTime(sprintTime)} - Sprint`)
    ).toBeVisible();
    await expect(
      this.overview.getByText(`${this.formatTime(recoveryTime)} - Gehen/Stehen`)
    ).toBeVisible();
    await expect(
      this.overview.getByText(`Gesamtzeit: ${this.formatTime(totalTime)}`)
    ).toBeVisible();
  }

  private formatTime(time: Seconds): string {
    const deciSeconds = Math.floor(time * 10);
    if (time < 1) {
      return `0,${deciSeconds} ms`;
    }
    if (time < 60) {
      return `${Math.floor(time)},0 sec`;
    }
    const minutes = Math.floor(time / 60);
    const seconds = ('' + (time - minutes * 60)).padStart(2, '0');
    return `${minutes}:${seconds} min`;
  }

  async configureSprintTraining({
    recoveryTime,
    sprintTime,
    repetitions,
  }: {
    repetitions: number;
    sprintTime: Seconds;
    recoveryTime: Seconds;
  }): Promise<void> {
    const repetitionsInput = this.sprintTraining.getByTestId('repetitions');
    await repetitionsInput.fill('' + repetitions);
    await repetitionsInput.blur();

    const sprintTimeInput = this.sprintTraining.getByTestId('sprintTime');
    await sprintTimeInput.fill('' + sprintTime);
    await sprintTimeInput.blur();

    const recoveryTimeInput = this.sprintTraining.getByTestId('recoveryTime');
    await recoveryTimeInput.fill('' + recoveryTime);
    await recoveryTimeInput.blur();
  }

  async startTraining(): Promise<void> {
    await this.expectTrainingStateStartable();
    await this.toggleTrainingCta.click();
  }

  async expectTrainingStatePausable(): Promise<void> {
    await expect(this.toggleTrainingCta).toContainText('Pausieren', {
      timeout: 10000,
    });
  }

  async expectTrainingStateStartable(): Promise<void> {
    await expect(this.toggleTrainingCta).toContainText('Go Go Go');
    await expect(this.stopTrainingCta).toBeHidden();
  }

  async expectTrainingStateStoppable(): Promise<void> {
    await this.stopTrainingCta.isEnabled({ timeout: 10000 });
    await expect(this.stopTrainingCta).toBeVisible();
    await expect(this.stopTrainingCta).toContainText('Training beenden');
  }

  async expectTrainingStateNotStoppable(): Promise<void> {
    await expect(this.stopTrainingCta).toBeHidden();
  }

  async expectTrainingStateResumable(): Promise<void> {
    await expect(this.toggleTrainingCta).toContainText('Weiter');
  }

  /** ends a running or paused training; the Zusammenfassung shows */
  async stopTraining(): Promise<void> {
    await expect(this.toggleTrainingCta).toContainText(/Pausieren|Weiter/, {
      timeout: 10000,
    });
    await this.expectTrainingStateStoppable();
    await this.stopTrainingCta.click();
    await expect(this.zusammenfassung).toBeVisible();
    await expect(this.toggleTrainingCta).toContainText('Neues Training');
  }

  /** ends the training during the 5 s Vorlauf */
  async abortVorlauf(): Promise<void> {
    await expect(this.toggleTrainingCta).toBeDisabled();
    // the Vorlauf lasts 5 s: the button has to be there well before it ends
    await expect(this.stopTrainingCta).toBeVisible({ timeout: 1000 });
    await this.stopTrainingCta.click();
    await this.expectTrainingStateStartable();
    await expect(this.zusammenfassung).toBeHidden();
  }

  async startNewTraining(): Promise<void> {
    await this.toggleTrainingCta.click();
    await this.expectTrainingStateStartable();
  }

  async expectZusammenfassung({
    sprintsCompleted,
    sprintsTotal,
    completion,
  }: {
    sprintsCompleted: number;
    sprintsTotal: number;
    completion: string;
  }): Promise<void> {
    await expect(this.zusammenfassung).toContainText(
      `${sprintsCompleted} von ${sprintsTotal} Sprints`
    );
    await expect(this.zusammenfassung).toContainText(completion);
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.expectTitleVisible();
  }

  async pauseTraining(): Promise<void> {
    await this.expectTrainingStatePausable();
    await this.toggleTrainingCta.click();
    await this.expectTrainingStateResumable();
    await expect(this.sprintTraining).toContainText('pausiert');
  }

  async resumeTraining(): Promise<void> {
    await this.expectTrainingStateResumable();
    await this.toggleTrainingCta.click();
  }

  async expectVorlaufAnnounced(): Promise<void> {
    await expect(this.sprintTraining).toContainText('als Nächstes: Bereit');
  }

  async expectCountdownTimer(number: number): Promise<void> {
    for (let i = number - 1; i > 0; i--) {
      await expect
        .poll(
          () =>
            this.countdownTimer
              .getByText(new RegExp(`${i},\\d sec`))
              .isVisible(),
          {
            intervals: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100],
          }
        )
        .toBe(true);
    }
  }
}
