import { z } from 'zod';
import { Note } from '../../../note';
import { publicProcedure, router } from '../trpc';

let noteId = 0;
const notes: Note[] = [];
export const noteRouter = router({
  create: publicProcedure
    .input(
      z.object({
        note: z.string(),
      })
    )
    .mutation(({ input }) => {
      const number: number = notes.push({
        id: noteId++,
        note: input.note,
        createdAt: new Date().toISOString(),
      });
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
