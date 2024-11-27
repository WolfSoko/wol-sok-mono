import { test, expect } from './fixtures/home-page-hydrated.fixture';

test.describe('Home', () => {
  test('has title', async ({ homePage }) => {
    await homePage.expectTitleVisible();
  });

  test('has sprint training', async ({ homePage }) => {
    await homePage.expectSprintTrainingVisible();
    await homePage.expectSprintTrainingConfiguration();
  });

  test('can configure sprint training', async ({ homePage }) => {
    await homePage.configureSprintTraining({
      repetitions: 7,
      sprintTime: 20,
      recoveryTime: 90,
    });

    await homePage.expectSprintTrainingConfiguration({
      repetitions: 7,
      sprintTime: 20,
      recoveryTime: 90,
      totalTime: 770,
    });
  });

  test('can not stop training when training is not started', async ({
    homePage,
  }) => {
    await homePage.sprintTraining.getByTestId('stop-training').isDisabled();
  });

  test('can start training', async ({ homePage }) => {
    await homePage.startTraining();
  });
});
