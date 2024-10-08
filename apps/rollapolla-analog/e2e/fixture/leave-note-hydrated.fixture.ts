import {
  expect,
  test as testBase,
} from '../fixture/home-page-hydrated.fixture';
import { NotesPoComp } from '../pos/notes.po-comp';

const test = testBase.extend<{ leaveNoteComp: NotesPoComp }>({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  leaveNoteComp: async ({ page, homePage }, use) => {
    const leaveNoteComp = new NotesPoComp(page);
    await use(leaveNoteComp);
  },
});

export { expect, test };
