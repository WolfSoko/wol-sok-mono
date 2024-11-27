import { expect, Page } from '@playwright/test';
import { SprintTrainingInputData } from '../../src/app/features/training-configuration/data/sprint-training-input.data';
import { SprintTrainingData } from '../../src/app/features/training-configuration/data/sprint-training.data';

export class SprintTrainingPage {
  readonly page: Page;

  readonly sprintTraining;

  constructor(page: Page) {
    this.page = page;
    this.sprintTraining = page.getByTestId('sprint-training');
  }

  async goto() {
    await this.page.goto('/');
  }

  async expectTitleVisible() {
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
  ) {
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
  }: SprintTrainingInputData) {
    await this.sprintTraining.getByTestId('repetitions').fill('' + repetitions);
    await this.sprintTraining.getByTestId('sprintTime').fill('' + sprintTime);
    await this.sprintTraining
      .getByTestId('recoveryTime')
      .fill('' + recoveryTime);
  }

  async startTraining() {
    await expect(
      this.sprintTraining.getByTestId('toggle-training')
    ).toContainText('Go Go Go');
    await this.sprintTraining.getByTestId('toggle-training').tap();
    await expect(
      this.sprintTraining.getByTestId('toggle-training')
    ).toContainText('Pausieren');
  }
}
