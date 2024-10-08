import { test } from './fixture/leave-note-hydrated.fixture';

test.describe('Leave a note', () => {
  test('should provide a way to leave a trimmed note', async ({
    leaveNoteComp,
  }) => {
    await leaveNoteComp.leaveTrimmedNote();
  });

  test('should send note by keypress CTRL+ENTER', async ({ leaveNoteComp }) => {
    await leaveNoteComp.sendNoteByKeypress();
  });
});
