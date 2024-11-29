import { beforeEach, describe, expect, it } from 'vitest';
import { SprintTrainingRunnerService } from './sprint-training-runner.service';

describe('SprintTrainingRunnerService', () => {
  let service: SprintTrainingRunnerService;

  beforeEach(() => {
    service = new SprintTrainingRunnerService();
  });

  it('should be created with initial state "stopped"', () => {
    expect(service.trainingState()).toBe('stopped');
  });

  it('should toggle training state to "running" from "stopped"', () => {
    service.toggleTraining();
    expect(service.trainingState()).toBe('running');
  });

  it('should toggle training state to "paused" from "running"', () => {
    service.toggleTraining(); // First toggle to "running"
    service.toggleTraining(); // Second toggle to "paused"
    expect(service.trainingState()).toBe('paused');
  });

  it('should end training and set state to "stopped"', () => {
    service.toggleTraining(); // Set to "running"
    service.endTraining();
    expect(service.trainingState()).toBe('stopped');
  });

  it('should remain "stopped" when endTraining is called while stopped', () => {
    service.endTraining();
    expect(service.trainingState()).toBe('stopped');
  });

  it('should toggle correctly between states', () => {
    service.toggleTraining(); // "stopped" -> "running"
    expect(service.trainingState()).toBe('running');
    service.toggleTraining(); // "running" -> "paused"
    expect(service.trainingState()).toBe('paused');
    service.toggleTraining(); // "paused" -> "running"
    expect(service.trainingState()).toBe('running');
  });
});
