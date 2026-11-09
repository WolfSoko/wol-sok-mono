import { EinstellungenPage } from './pos/einstellungen.page';
import { StartPage } from './pos/start.page';
import { TeamPage } from './pos/team.page';
import { expect, test } from './fixtures/pages.fixture';

const MTV_WASBUETTEL = 313036;

/** A new account of the Auth emulator per run, so reruns start empty. */
function neuesKonto(name: string) {
  return {
    email: `${name.toLowerCase()}-${Date.now()}@example.com`,
    name: `Familie ${name}`,
  };
}

/*
 * Sign-in through the Auth and Firestore emulators (`korbjaeger:emulatoren`).
 * The clock is left alone: Auth's tokens carry the real time.
 */
test.describe('the account', () => {
  test('keeps Meine Teams the same on a second device signed in with it', async ({
    page,
    browser,
    startPage,
    teamPage,
    einstellungenPage,
  }) => {
    const konto = neuesKonto('Muster');
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.folgen.click();
    await expect(teamPage.folgen).toHaveAttribute('aria-pressed', 'true');

    await page.getByRole('link', { name: 'Einstellungen' }).click();
    await einstellungenPage.anmeldenAls(konto, { neu: true });
    await expect(einstellungenPage.kontoName).toHaveText(
      'Angemeldet als Familie Muster'
    );
    await startPage.goto();
    await expect(startPage.team('MTV Wasbüttel')).toBeVisible();

    const zweitesGeraet = await browser.newContext();
    const zweiteSeite = await zweitesGeraet.newPage();
    const zweiteEinstellungen = new EinstellungenPage(zweiteSeite);
    const zweiterStart = new StartPage(zweiteSeite);
    await zweiterStart.goto();
    await expect(zweiterStart.leer).toBeVisible();
    await zweiteEinstellungen.goto();
    await zweiteEinstellungen.anmeldenAls(konto, { neu: false });
    await expect(zweiteEinstellungen.kontoName).toHaveText(
      'Angemeldet als Familie Muster'
    );
    await zweiterStart.goto();
    await expect(zweiterStart.team('MTV Wasbüttel')).toBeVisible();

    // what one device changes shows on the other
    const zweitesTeam = new TeamPage(zweiteSeite);
    await zweitesTeam.goto(MTV_WASBUETTEL);
    await zweitesTeam.folgen.click();
    await expect(zweitesTeam.folgen).toHaveAttribute('aria-pressed', 'false');
    await startPage.goto();
    await expect(startPage.leer).toBeVisible();

    await zweiteEinstellungen.goto();
    await zweiteEinstellungen.abmelden.click();
    await expect(zweiteEinstellungen.anmelden).toBeVisible();
    await zweiterStart.goto();
    await expect(zweiterStart.leer).toBeVisible();
    await zweitesGeraet.close();
  });

  test('deletes the account and its choices', async ({
    page,
    startPage,
    teamPage,
    einstellungenPage,
  }) => {
    await teamPage.goto(MTV_WASBUETTEL);
    await teamPage.folgen.click();
    await expect(teamPage.folgen).toHaveAttribute('aria-pressed', 'true');
    await einstellungenPage.goto();
    const konto = neuesKonto('Beispiel');
    await einstellungenPage.anmeldenAls(konto, { neu: true });
    await expect(einstellungenPage.kontoName).toBeVisible();

    await einstellungenPage.loeschen(konto);

    await expect(einstellungenPage.anmelden).toBeVisible();
    await startPage.goto();
    await expect(startPage.leer).toBeVisible();
    await page.reload();
    await expect(startPage.leer).toBeVisible();
  });
});
