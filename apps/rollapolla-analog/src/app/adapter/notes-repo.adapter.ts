import { inject, Injectable, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';

import {
  collection,
  collectionData,
  CollectionReference,
  Firestore,
  limit,
  orderBy,
  query,
} from '@angular/fire/firestore';
import { ChatMessage } from '../../shared/chat.message';
import { NotesRepoPort } from '../ports/notes-repo.port';
import { NoteDto } from './note.dto';
import { notesConverter } from './notes.converter';

@Injectable({ providedIn: 'root' })
export class NotesRepoAdapter extends NotesRepoPort {
  private readonly fs: Firestore = inject(Firestore);
  private readonly notes: Signal<ChatMessage[] | undefined>;
  private readonly notesCol: CollectionReference<ChatMessage, NoteDto>;

  constructor() {
    super();
    this.notesCol = collection(this.fs, 'notes').withConverter<
      ChatMessage,
      NoteDto
    >(notesConverter);

    const notes$ = collectionData(
      query(this.notesCol, orderBy('createdAt', 'desc'), limit(20))
    );

    this.notes = toSignal(notes$, { rejectErrors: true });
  }

  getNotes(): Signal<ChatMessage[] | undefined> {
    return this.notes;
  }

  /**
   *
   * @param note
   * @deprecated use new ChatMessageAdapter
   */
  async addNote(note: string): Promise<void> {
    throw new Error('Deprecated');
  }
}
