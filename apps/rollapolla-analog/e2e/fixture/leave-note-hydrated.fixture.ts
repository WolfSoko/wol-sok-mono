import {
  expect,
  test as testBase,
} from '../fixture/home-page-hydrated.fixture';
import { NotesPoComp } from '../pos/notes.po-comp';

const test = testBase.extend<{ leaveNoteComp: NotesPoComp }>({

  leaveNoteComp: async ({ page, homePage }, use) => {
    await homePage.expectTitleVisible()
    const leaveNoteComp = new NotesPoComp(page);
    await use(leaveNoteComp);
  },
});

export { expect, test };
