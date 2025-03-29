import {
  expect,
  test as testBase,
} from '../fixture/home-page-hydrated.fixture';
import { LiveChatPoComp } from '../pos/live-chat-po.comp';

const test = testBase.extend<{ liveChatComp: LiveChatPoComp }>({
  liveChatComp: async ({ page, homePage }, use) => {
    await homePage.expectTitleVisible();
    const liveChatComp = new LiveChatPoComp(page);
    await use(liveChatComp);
  },
});

export { expect, test };
