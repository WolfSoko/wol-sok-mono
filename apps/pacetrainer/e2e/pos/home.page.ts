import { expect, Page } from '@playwright/test';
import { SprintTrainingData } from '../../src/app/features/training-configuration/data/sprint-training.data';

export class HomePage {
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
      this.page.getByRole('heading', {
        name: 'Pace-Trainer',
      })
    ).toBeVisible();
    await expect(
      this.page.getByText('Dein digitaler Laufcoach.')
    ).toBeVisible();
  }

  async expectSprintTrainingVisible() {
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
}
