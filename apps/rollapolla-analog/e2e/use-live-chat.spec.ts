import { test, expect } from './fixture/live-chat-hydrated.fixture';

test.describe('Use live chat', () => {
  test('should trimme the message', async ({ liveChatComp }) => {
    const message = `  Hello, world!${Math.random()}  `;
    await liveChatComp.enterUntrimmedMessage(message);
    await expect(liveChatComp.findMessageInChat(message.trim())).toBeVisible();
  });

  test('should send message by keypress CTRL+ENTER', async ({
    liveChatComp,
  }) => {
    const message = `Hello World from Playwright ${Math.random()}`;
    await liveChatComp.sendMessageByKeypress(message);
    await expect(liveChatComp.findMessageInChat(message)).toBeVisible();
  });
});
