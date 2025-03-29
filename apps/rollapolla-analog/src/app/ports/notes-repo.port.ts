import { Signal } from '@angular/core';
import { ChatMessage } from '../../shared/chat.message';

export abstract class NotesRepoPort {
  abstract getNotes(): Signal<ChatMessage[] | undefined>;
}
