import { isPlatformServer } from '@angular/common';
import { inject, PendingTasks, PLATFORM_ID } from '@angular/core';

const noop = () => {
  // noop
};

/**
 *
 * needs to run in injection context if is server environment, inform zoneless context to wait for the notes to be loaded
 */
export function addPendingTaskForServer(): {
  finishRendering: () => void;
  isServer: boolean;
} {
  //
  if (isPlatformServer(inject(PLATFORM_ID))) {
    return { finishRendering: inject(PendingTasks).add(), isServer: true };
  }
  return {
    finishRendering: noop,
    isServer: isPlatformServer(inject(PLATFORM_ID)),
  };
}
