import { test } from './fixture/home-page-hydrated.fixture';
import { AccountPo } from './pos/account.po';

test.describe('Google sign-in', () => {
  test('signs in with Google and out again', async ({ page, homePage }) => {
    await homePage.expectTitleVisible();
    const account = new AccountPo(page);
    const name = `Ada ${Math.random().toString(36).slice(2, 8)}`;

    await account.signInWithNewGoogleAccount(name);
    await account.expectSignedInAs(name);

    await page.reload();
    await account.expectSignedInAs(name);

    await account.signOut();
  });
});
