import { Provider } from '@angular/core';
import { AccountAdapter } from './adapter/account.adapter';
import { ChatMessagesRepoAdapter } from './adapter/chat-messages-repo-adapter.service';
import { NotesRepoAdapter } from './adapter/notes-repo.adapter';
import { PollsRepoAdapter } from './adapter/polls-repo.adapter';
import { AccountPort } from './ports/account.port';
import { ChatMessagesRepoPort } from './ports/chat-messages-repo.port';
import { NotesRepoPort } from './ports/notes-repo.port';
import { PollsRepoPort } from './ports/polls-repo.port';

export function providePortsAndAdapter(): Provider[] {
  return [
    { provide: NotesRepoPort, useClass: NotesRepoAdapter },
    { provide: ChatMessagesRepoPort, useClass: ChatMessagesRepoAdapter },
    { provide: PollsRepoPort, useClass: PollsRepoAdapter },
    { provide: AccountPort, useClass: AccountAdapter },
  ];
}
