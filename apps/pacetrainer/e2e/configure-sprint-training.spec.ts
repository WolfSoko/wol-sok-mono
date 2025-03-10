import { seconds } from '../src/app/shared/model/constants/time-utils';
import { test } from './fixtures/sprint-training.fixture';

test.describe('Sprint Training', () => {
  test('has sprint training', async ({ sprintTraining }) => {
    await sprintTraining.expectTitleVisible();
    await sprintTraining.expectTrainingStateStartable();
    await sprintTraining.expectSprintTrainingConfiguration();
  });

  test('can configure sprint training', async ({ sprintTraining }) => {
    await sprintTraining.configureSprintTraining({
      repetitions: 7,
      sprintTime: seconds(20),
      recoveryTime: seconds(90),
    });

    await sprintTraining.expectSprintTrainingConfiguration({
      repetitions: 7,
      sprintTime: seconds(20),
      recoveryTime: seconds(90),
      totalTime: seconds(770),
    });
  });
});
