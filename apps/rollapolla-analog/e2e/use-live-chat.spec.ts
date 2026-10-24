import { test, expect } from './fixture/live-chat-hydrated.fixture';

test.describe('Use live chat', () => {
  test('asks a guest to sign in before chatting', async ({ liveChatComp }) => {
    await liveChatComp.expectSignInRequired();
  });

  test('should trimme the message', async ({ chatter }) => {
    const message = `  Hello, world!${Math.random()}  `;
    await chatter.enterUntrimmedMessage(message);
    await expect(chatter.findMessageInChat(message.trim())).toBeVisible();
  });

  test('should send message by keypress CTRL+ENTER', async ({ chatter }) => {
    const message = `Hello World from Playwright ${Math.random()}`;
    await chatter.sendMessageByKeypress(message);
    await expect(chatter.findMessageInChat(message)).toBeVisible();
  });
});
