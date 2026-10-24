/**
 * A worker of the balance lab: plays the cells its parent sends, one at a
 * time, and sends each result back. Started by `run.ts` through `fork`.
 */
import {
  LabMatch,
  playLabMatch,
} from '../../../libs/features/lazy/bacteria-game/src/lib/state/balance/lab-match';
import type { NamedCell } from '../../../libs/features/lazy/bacteria-game/src/lib/state/balance/report';

export interface WorkerResult {
  index: number;
  match: LabMatch;
}

process.on(
  'message',
  (message: { index: number; cell: NamedCell } | 'done') => {
    if (message === 'done') {
      process.exit(0);
    }
    const match = playLabMatch(message.cell);
    process.send?.({ index: message.index, match } satisfies WorkerResult);
  }
);
