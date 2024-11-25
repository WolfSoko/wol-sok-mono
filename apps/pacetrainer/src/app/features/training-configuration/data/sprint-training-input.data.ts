import { SprintTrainingData } from './sprint-training.data';

export type SprintTrainingInputData = Omit<SprintTrainingData, 'totalTime'>;
