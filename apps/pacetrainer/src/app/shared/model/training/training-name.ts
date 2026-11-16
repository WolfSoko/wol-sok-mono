/** what the runner does in an Intervall */
export type TrainingName = 'recovery' | 'sprint' | 'running';

/** what a countdown counts down to: the next Intervall or the end of the Trainingslauf */
export type CountdownTarget = TrainingName | 'finished';
