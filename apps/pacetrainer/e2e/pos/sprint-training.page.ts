import { expect, Locator, Page } from '@playwright/test';
import { SprintTrainingInputData } from '../../src/app/features/training-configuration/data/sprint-training-input.data';
import { SprintTrainingData } from '../../src/app/features/training-configuration/data/sprint-training.data';

export class SprintTrainingPage {
  readonly page: Page;

  readonly sprintTraining: Locator;
  readonly toggleTrainingCta: Locator;
  readonly stopTrainingCta: Locator;

  constructor(page: Page) {
    this.page = page;
    this.sprintTraining = page.getByTestId('sprint-training');
    this.toggleTrainingCta = this.sprintTraining.getByTestId('toggle-training');
    this.stopTrainingCta = this.sprintTraining.getByTestId('stop-training');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  async expectTitleVisible(): Promise<void> {
    await expect(
      this.sprintTraining.getByText('Sprint Training')
    ).toBeVisible();
  }

  async expectSprintTrainingConfiguration(
    { repetitions, sprintTime, recoveryTime, totalTime }: SprintTrainingData = {
      repetitions: 4,
      recoveryTime: 60,
      sprintTime: 10,
      totalTime: 280,
    }
  ): Promise<void> {
    await expect(
      this.sprintTraining.getByText(`${repetitions} Wiederholungen`)
    ).toBeVisible();
    await expect(
      this.sprintTraining.getByText(`${sprintTime}s - Sprint`)
    ).toBeVisible();
    await expect(
      this.sprintTraining.getByText(`${recoveryTime}s - Gehen/Stehen`)
    ).toBeVisible();
    await expect(
      this.sprintTraining.getByText(`Gesamtzeit: ${totalTime}s`)
    ).toBeVisible();
  }

  async configureSprintTraining({
    recoveryTime,
    sprintTime,
    repetitions,
  }: SprintTrainingInputData): Promise<void> {
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
}
