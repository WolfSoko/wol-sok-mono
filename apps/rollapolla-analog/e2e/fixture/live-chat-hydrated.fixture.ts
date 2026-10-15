import {
  expect,
  test as testBase,
} from '../fixture/home-page-hydrated.fixture';
import { AccountPo } from '../pos/account.po';
import { LiveChatPoComp } from '../pos/live-chat-po.comp';

const test = testBase.extend<{
  /** The live chat as a guest sees it: reading only. */
  liveChatComp: LiveChatPoComp;
  /** The live chat signed in with a fresh Google account, so posting works. */
  chatter: LiveChatPoComp;
}>({
  liveChatComp: async ({ page, homePage }, use) => {
    await homePage.expectTitleVisible();
    const liveChatComp = new LiveChatPoComp(page);
    await use(liveChatComp);
  },
  chatter: async ({ page, liveChatComp }, use) => {
    const account = new AccountPo(page);
    const name = `Chatter ${Math.random().toString(36).slice(2, 8)}`;
    await account.signInWithNewGoogleAccount(name);
    await account.expectSignedInAs(name);
    await use(liveChatComp);
  },
});

export { expect, test };
