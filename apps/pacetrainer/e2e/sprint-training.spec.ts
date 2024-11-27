import { test } from './fixtures/sprint-training.fixture';

test.describe('Sprint Training', () => {
  test('has sprint training', async ({ sprintTraining }) => {
    await sprintTraining.expectTitleVisible();
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
    await sprintTraining.sprintTraining
      .getByTestId('stop-training')
      .isDisabled();
  });

  test('can start training', async ({ sprintTraining }) => {
    await sprintTraining.startTraining();
  });
});
