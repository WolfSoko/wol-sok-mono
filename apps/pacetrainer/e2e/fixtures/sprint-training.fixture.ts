import { test as testBase, expect } from './logs.fixture';
import { SprintTrainingPage } from '../pos/sprint-training.page';

type SprintTrainingFixture = { sprintTraining: SprintTrainingPage };

const test = testBase.extend<SprintTrainingFixture>({
  sprintTraining: async ({ page, logs }, use) => {
    const sprintTraining = new SprintTrainingPage(page);
    await sprintTraining.goto();
    await expect(logs).toHaveConsoleMsg('Angular hydrated');
    await sprintTraining.expectTitleVisible();
    await use(sprintTraining);
  },
});

export { expect, test };
