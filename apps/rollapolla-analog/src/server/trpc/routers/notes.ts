import { z } from 'zod';
import { Note } from '../../../note';
import { publicProcedure, router } from '../trpc';

let noteId = 0;
const initialMessage: Note = {
  id: noteId++,
  createdAt: new Date().toISOString(),
  note: 'Hello RollaPolla users!',
};
const notes: Note[] = [initialMessage];

const MAX_NOTES = 50;
const NOTE_MAX_LENGTH = 200;
export const noteRouter = router({
  create: publicProcedure
    .input(
      z.object({
        note: z.string({ required_error: 'Note is required' }),
      })
    )
    .mutation(({ input }) => {
      const number: number = notes.push({
        id: noteId++,
        note: input.note.substring(0, NOTE_MAX_LENGTH),
        createdAt: new Date().toISOString(),
      });
      if (notes.length > MAX_NOTES) {
        notes.shift();
      }
      return number;
    }),
  list: publicProcedure.query(() => notes),
  remove: publicProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(({ input }) => {
      const index = notes.findIndex((note) => input.id === note.id);
      notes.splice(index, 1);
    }),
});
