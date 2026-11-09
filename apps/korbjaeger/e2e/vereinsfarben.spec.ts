import type { Page } from '@playwright/test';
import { expect, test } from './fixtures/pages.fixture';

/** In the fixtures, MTV Wasbüttel's Team. */
const TEAM = 313036;

/** The colour a token resolves to on an element of the page, as the browser computes it. */
function primaerfarbe(page: Page): Promise<string> {
  return page
    .getByRole('heading', { level: 1 })
    .evaluate((h1) => getComputedStyle(h1).borderBlockEndColor);
}

test.describe('Vereinsfarben', () => {
  test("puts a Verein's colours on its Team page, kept across a reload, and takes them back", async ({
    page,
    teamPage,
  }) => {
    await teamPage.goto(TEAM);
    await expect(teamPage.heading).toHaveText('MTV Wasbüttel');
    const eigene = await primaerfarbe(page);

    await page.getByRole('button', { name: 'Vereinsfarben' }).click();
    const blatt = page.getByRole('dialog', { name: /Vereinsfarben/ });
    await blatt
      .getByRole('radiogroup', { name: 'Hauptfarbe' })
      .getByRole('radio', { name: 'Königsblau' })
      .click();
    await blatt.getByRole('button', { name: 'Übernehmen' }).click();
    await expect(blatt).toBeHidden();

    await expect.poll(() => primaerfarbe(page)).not.toBe(eigene);
    const blau = await primaerfarbe(page);
    await page.reload();
    await expect.poll(() => primaerfarbe(page)).toBe(blau);

    await page.getByRole('button', { name: 'Vereinsfarben' }).click();
    await page.getByRole('button', { name: 'Zurücksetzen' }).click();
    await expect.poll(() => primaerfarbe(page)).toBe(eigene);
  });
});
