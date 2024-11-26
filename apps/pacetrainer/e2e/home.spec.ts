import { test } from './fixtures/home-page-hydrated.fixture';

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
});
