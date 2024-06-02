import { Provider } from '@angular/core';
import { NotesRepoAdapter } from './adapter/notes-repo.adapter';
import { NotesRepoPort } from './ports/notes-repo.port';

export function providePortsAndAdapter(): Provider[] {
  return [{ provide: NotesRepoPort, useClass: NotesRepoAdapter }];
}
