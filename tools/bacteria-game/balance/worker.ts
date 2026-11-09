/**
 * A worker of the balance lab: plays the cells its parent sends, one at a
 * time, and sends each result back. Started by `run.ts` through `fork`.
 */
import {
  type LabMatch,
  type NamedCell,
  playLabMatch,
} from '@wolsok/feat-shared-bacteria-engine/balance';

export interface WorkerResult {
  index: number;
  match: LabMatch;
}

// A runner that was stopped takes its workers with it.
process.on('disconnect', () => process.exit(0));

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
