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
  private countdownTimer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.overview = page.getByTestId('training-overview');
    this.sprintTraining = page.getByTestId('sprint-training');
    this.toggleTrainingCta = this.sprintTraining.getByTestId('toggle-training');
    this.stopTrainingCta = this.sprintTraining.getByTestId('stop-training');
    this.countdownTimer = this.sprintTraining.getByTestId('countdown-timer');
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
    ).not.toBeVisible();
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
    await this.sprintTraining.getByTestId('repetitions').fill('' + repetitions);
    await this.sprintTraining.getByTestId('sprintTime').fill('' + sprintTime);
    await this.sprintTraining
      .getByTestId('recoveryTime')
      .fill('' + recoveryTime);
  }

  async startTraining(): Promise<void> {
    await this.expectTrainingStateStartable();
    await this.toggleTrainingCta.click();
    await expect(this.toggleTrainingCta).toContainText('Pausieren');
  }

  async expectTrainingStateStartable(): Promise<void> {
    await expect(this.toggleTrainingCta).toContainText('Go Go Go');
    await this.stopTrainingCta.isDisabled();
  }

  async expectTrainingStateStoppable(): Promise<void> {
    await this.stopTrainingCta.isEnabled();
    await expect(this.stopTrainingCta).toContainText('Training beenden');
  }

  async expectTrainingStateNotStoppable(): Promise<void> {
    await this.stopTrainingCta.isDisabled();
  }

  async expectTrainingStateResumable(): Promise<void> {
    await expect(this.toggleTrainingCta).toContainText('Weiter');
  }

  async stopTraining(): Promise<void> {
    await this.expectTrainingStateStoppable();
    await this.stopTrainingCta.click();
    await this.expectTrainingStateStartable();
  }

  async pauseTraining(): Promise<void> {
    await this.expectTrainingStatePausable();
    await this.toggleTrainingCta.click();
    await this.expectTrainingStateResumable();
  }

  async expectTrainingStatePausable(): Promise<void> {
    await expect(this.toggleTrainingCta).toContainText('Pausieren');
  }

  async resumeTraining(): Promise<void> {
    await this.expectTrainingStateResumable();
    await this.toggleTrainingCta.click();
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
