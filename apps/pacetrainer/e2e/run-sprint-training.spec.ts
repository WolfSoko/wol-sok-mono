import { test } from './fixtures/sprint-training.fixture';

test.describe(' Run Sprint Training', () => {
  test('hide config after starting training', async ({ sprintTraining }) => {
    await sprintTraining.startTraining();
    await sprintTraining.expectSprintTrainingConfigurationNotVisible();
  });

  test('show config after stopping training', async ({ sprintTraining }) => {
    await sprintTraining.startTraining();
    await sprintTraining.stopTraining();
    await sprintTraining.expectSprintTrainingConfiguration();
  });

  test('it shows a timer counting down from 5 to 0 before training time starts', async ({
    sprintTraining,
  }) => {
    await sprintTraining.startTraining();
    await sprintTraining.expectCountdownTimer(5);
  });
});
