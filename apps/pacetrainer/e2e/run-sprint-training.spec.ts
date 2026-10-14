import { test } from './fixtures/sprint-training.fixture';

test.describe('Run Sprint Training', () => {
  test('hide config after starting training', async ({ sprintTraining }) => {
    await sprintTraining.startTraining();
    await sprintTraining.expectSprintTrainingConfigurationNotVisible();
  });

  test('show config after a new training is chosen', async ({
    sprintTraining,
  }) => {
    await sprintTraining.startTraining();
    await sprintTraining.stopTraining();
    await sprintTraining.startNewTraining();
    await sprintTraining.expectSprintTrainingConfiguration();
  });

  test('shows a Zusammenfassung after ending the training', async ({
    sprintTraining,
  }) => {
    await sprintTraining.startTraining();
    await sprintTraining.stopTraining();
    await sprintTraining.expectZusammenfassung({
      sprintsCompleted: 0,
      sprintsTotal: 4,
      completion: 'Vorzeitig beendet',
    });
  });

  test('can abort the Vorlauf', async ({ sprintTraining }) => {
    await sprintTraining.startTraining();
    await sprintTraining.abortVorlauf();
    await sprintTraining.expectSprintTrainingConfiguration();
  });

  test('restores a running training as paused after a reload', async ({
    sprintTraining,
  }) => {
    await sprintTraining.startTraining();
    await sprintTraining.expectTrainingStatePausable();
    await sprintTraining.reload();
    await sprintTraining.expectTrainingStateResumable();
    await sprintTraining.resumeTraining();
    await sprintTraining.expectTrainingStatePausable();
  });

  test('it shows a timer counting down from 5 to 0 when training starts', async ({
    sprintTraining,
  }) => {
    await sprintTraining.startTraining();
    await sprintTraining.expectVorlaufAnnounced();
    await sprintTraining.expectCountdownTimer(5);
    await sprintTraining.expectTrainingStatePausable();
  });

  test('can start training', async ({ sprintTraining }) => {
    await sprintTraining.startTraining();
  });

  test('can stop training', async ({ sprintTraining }) => {
    await sprintTraining.startTraining();
    await sprintTraining.stopTraining();
  });

  test('can not stop training when training is not started', async ({
    sprintTraining,
  }) => {
    await sprintTraining.expectTrainingStateNotStoppable();
  });

  test('can pause and resume training', async ({ sprintTraining }) => {
    await sprintTraining.startTraining();
    await sprintTraining.pauseTraining();
    await sprintTraining.resumeTraining();
  });
});
