import { test } from '@playwright/test';
import { NotesPoComp } from './pos/notes.po-comp';

test.describe('Leave a note', () => {
  let leaveNotePage: NotesPoComp;

  test.beforeEach(async ({ page }) => {
    leaveNotePage = new NotesPoComp(page);
    await leaveNotePage.goto();
  });

  test('should provide a way to leave a trimmed note', async () => {
    await leaveNotePage.leaveTrimmedNote();
  });

  test('should send note by keypress CTRL+ENTER', async () => {
    await leaveNotePage.sendNoteByKeypress();
  });
});
