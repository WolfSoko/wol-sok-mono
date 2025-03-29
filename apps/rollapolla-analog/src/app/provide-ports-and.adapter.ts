import { Provider } from '@angular/core';
import { ChatMessagesRepoAdapter } from './adapter/chat-messages-repo-adapter.service';
import { NotesRepoAdapter } from './adapter/notes-repo.adapter';
import { ChatMessagesRepoPort } from './ports/chat-messages-repo.port';
import { NotesRepoPort } from './ports/notes-repo.port';

export function providePortsAndAdapter(): Provider[] {
  return [
    { provide: NotesRepoPort, useClass: NotesRepoAdapter },
    { provide: ChatMessagesRepoPort, useClass: ChatMessagesRepoAdapter },
  ];
}
