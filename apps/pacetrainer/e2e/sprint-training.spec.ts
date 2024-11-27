import { test } from './fixtures/sprint-training.fixture';

test.describe('Sprint Training', () => {
  test('has sprint training', async ({ sprintTraining }) => {
    await sprintTraining.expectTitleVisible();
    await sprintTraining.expectTrainingStateStartable();
    await sprintTraining.expectTrainingStateStoppable();
    await sprintTraining.expectSprintTrainingConfiguration();
  });

  test('can configure sprint training', async ({ sprintTraining }) => {
    await sprintTraining.configureSprintTraining({
      repetitions: 7,
      sprintTime: 20,
      recoveryTime: 90,
    });

    await sprintTraining.expectSprintTrainingConfiguration({
      repetitions: 7,
      sprintTime: 20,
      recoveryTime: 90,
      totalTime: 770,
    });
  });

  test('can not stop training when training is not started', async ({
    sprintTraining,
  }) => {
    await sprintTraining.expectTrainingStateNotStoppable();
  });

  test('can start training', async ({ sprintTraining }) => {
    await sprintTraining.expectTrainingStateStartable();
    await sprintTraining.startTraining();
  });

  test('can stop training', async ({ sprintTraining }) => {
    await sprintTraining.startTraining();
    await sprintTraining.stopTraining();
  });

  test('can pause and resume training', async ({ sprintTraining }) => {
    await sprintTraining.startTraining();
    await sprintTraining.pauseTraining();
    await sprintTraining.resumeTraining();
  });
});
