import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { LocalSelection } from '@wolsok/feat-korbjaeger-selection';
import { provideAppearance } from '../appearance/appearance';
import { SettingsComponent } from './settings.component';
import { notTakenOverText } from './not-taken-over-text';
import { PopupBlocked } from './account-service';
import { ACCOUNT_SESSION } from './account';
import { AccountSession } from './account-session';
import { FakeAccountService, FlagInSpec } from './testing/fake-account-service';

interface Page {
  readonly element: HTMLElement;
  readonly service: FakeAccountService;
  readonly loaded: () => number;
  readonly stable: () => Promise<void>;
  readonly button: (qa: string) => HTMLButtonElement | null;
  readonly error: () => string | undefined;
}

async function openPage(
  options: {
    withoutSignIn?: boolean;
    service?: FakeAccountService;
    online?: () => boolean;
    local?: LocalSelection;
    /** Holds Firebase's chunk back until it resolves. */
    loadWaitsFor?: Promise<void>;
    /** How many loads of Firebase's chunk fail first (offline). */
    loadFails?: number;
  } = {}
): Promise<Page> {
  const service = options.service ?? new FakeAccountService();
  let loads = 0;
  const session = new AccountSession(
    options.local ?? new LocalSelection(undefined),
    options.withoutSignIn
      ? undefined
      : async () => {
          loads++;
          await options.loadWaitsFor;
          if (loads <= (options.loadFails ?? 0)) {
            throw new Error('Failed to fetch dynamically imported module');
          }
          return service;
        },
    new FlagInSpec(),
    options.online
  );
  await session.start();
  TestBed.configureTestingModule({
    providers: [
      { provide: ACCOUNT_SESSION, useValue: session },
      provideAppearance(),
      { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
    ],
  });
  const fixture = TestBed.createComponent(SettingsComponent);
  const element = fixture.nativeElement as HTMLElement;
  const stable = async (): Promise<void> => {
    fixture.detectChanges();
    await new Promise((proceed) => setTimeout(proceed));
    fixture.detectChanges();
  };
  await stable();
  return {
    element,
    service,
    loaded: () => loads,
    stable,
    button: (qa) =>
      element.querySelector<HTMLButtonElement>(`[data-qa="${qa}"]`),
    error: () =>
      element.querySelector('.error[role="alert"]')?.textContent?.trim(),
  };
}

async function signedIn(
  service?: FakeAccountService,
  online?: () => boolean
): Promise<Page> {
  const page = await openPage({ service, online });
  page.button('sign-in')?.click();
  await page.stable();
  page.service.calls.length = 0;
  return page;
}

/** The delete dialog's confirm, or its cancel. */
function inDialog(qa: 'delete-account-confirm' | 'cancel'): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>(
    'korb-delete-account-dialog button'
  );
  const button = [...buttons].find((element) =>
    qa === 'cancel'
      ? element.textContent?.trim() === 'Abbrechen'
      : element.dataset['qa'] === qa
  );
  button?.click();
}

describe('EinstellungenComponent', () => {
  afterEach(() => {
    document.querySelector('.cdk-overlay-container')?.replaceChildren();
  });

  it('offers only the look where the build offers no sign-in', async () => {
    const { element, button } = await openPage({ withoutSignIn: true });

    expect(element.querySelector('korb-appearance-choice')).not.toBeNull();
    expect(element.textContent).not.toContain('Konto');
    expect(button('sign-in')).toBeNull();
  });

  it('loads Firebase as it opens, so the click opens the popup at once', async () => {
    const { loaded, service } = await openPage();

    expect(loaded()).toBe(1);
    expect(service.calls).toEqual([]);
  });

  it('signs in with Google and names the account', async () => {
    const { element, button, stable, service } = await openPage();

    button('sign-in')?.click();
    await stable();

    expect(service.calls[0]).toBe('signInWithGoogle');
    expect(
      element.querySelector('[data-qa="account-name"]')?.textContent?.trim()
    ).toBe('Angemeldet als Familie Muster');
    expect(button('sign-in')).toBeNull();
    expect(button('sign-out')).not.toBeNull();
  });

  it('shows nothing when the Elternteil closes the popup', async () => {
    const service = new FakeAccountService();
    service.cancelled = true;
    const { button, stable, error } = await openPage({ service });

    button('sign-in')?.click();
    await stable();

    expect(error()).toBeUndefined();
    expect(button('sign-in')).not.toBeNull();
  });

  it('says so where the browser blocked the popup', async () => {
    const service = new FakeAccountService();
    service.popupError = new PopupBlocked();
    const { button, stable, error } = await openPage({ service });

    button('sign-in')?.click();
    await stable();

    expect(error()).toBe(
      'Dein Browser hat das Fenster von Google blockiert. Erlaube Pop-ups für diese Seite und versuche es noch einmal.'
    );
  });

  it('keeps the sign-in disabled, saying it is getting ready, until Firebase is loaded', async () => {
    let loaded = (): void => undefined;
    const loadWaitsFor = new Promise<void>((proceed) => (loaded = proceed));
    const { button, stable, element } = await openPage({ loadWaitsFor });

    expect(button('sign-in')?.disabled).toBe(true);
    expect(
      element.querySelector('[data-qa="sign-in-preparing"]')
    ).not.toBeNull();

    loaded();
    await stable();

    expect(button('sign-in')?.disabled).toBe(false);
    expect(element.querySelector('[data-qa="sign-in-preparing"]')).toBeNull();
  });

  it('says where the sign-in could not be loaded, and loads it again on asking', async () => {
    const { button, stable, element, loaded } = await openPage({
      loadFails: 1,
    });

    expect(button('sign-in')?.disabled).toBe(true);
    expect(
      element.querySelector('[data-qa="prepare-failed"]')?.textContent?.trim()
    ).toBe(
      'Die Anmeldung ließ sich nicht laden. Bitte prüfe die Internetverbindung.'
    );

    button('prepare-again')?.click();
    await stable();

    expect(loaded()).toBe(2);
    expect(button('sign-in')?.disabled).toBe(false);
    expect(element.querySelector('[data-qa="prepare-failed"]')).toBeNull();
  });

  it('shows a deletion still running, and its failure, on settings opened again meanwhile', async () => {
    const service = new FakeAccountService();
    const page = await signedIn(service);
    const confirmed = Promise.withResolvers<void>();
    service.deletionConfirmed = confirmed.promise;
    service.deleteAuthUserFails = true;
    page.button('delete-account')?.click();
    await page.stable();
    inDialog('delete-account-confirm');
    await page.stable();

    const again = TestBed.createComponent(SettingsComponent);
    again.detectChanges();
    const element = again.nativeElement as HTMLElement;
    expect(
      element.querySelector('[data-qa="deletion-running"]')
    ).not.toBeNull();
    expect(
      element.querySelector<HTMLButtonElement>('[data-qa="sign-out"]')?.disabled
    ).toBe(true);

    confirmed.resolve();
    await page.stable();
    again.detectChanges();
    expect(
      element.querySelector('.error[role="alert"]')?.textContent?.trim()
    ).toBe(
      'Deine Teams und Kinder sind gelöscht, dein Konto selbst noch nicht. Bitte lösche es noch einmal.'
    );
  });

  it('drops what did not fit once another tab switched to another account', async () => {
    const service = new FakeAccountService();
    service.leftOver = { teams: [9001], children: [], clubColors: [] };
    const { button, stable, element } = await openPage({ service });
    button('sign-in')?.click();
    await stable();
    expect(element.querySelector('[data-qa="not-taken-over"]')).not.toBeNull();

    service.authReports({ uid: 'uid-2', name: 'Familie Beispiel' });
    await stable();

    expect(element.querySelector('[data-qa="not-taken-over"]')).toBeNull();
  });

  it('says the account is being deleted until the server confirmed it', async () => {
    const service = new FakeAccountService();
    const page = await signedIn(service);
    const confirmed = Promise.withResolvers<void>();
    service.deletionConfirmed = confirmed.promise;

    page.button('delete-account')?.click();
    await page.stable();
    inDialog('delete-account-confirm');
    await page.stable();

    expect(
      page.element
        .querySelector('[data-qa="deletion-running"]')
        ?.textContent?.trim()
    ).toBe(
      'Das Konto wird gelöscht. Ohne Internet wartet das, bis dein Gerät wieder online ist; lass die App so lange offen.'
    );
    expect(page.button('sign-out')?.disabled).toBe(true);

    confirmed.resolve();
    await page.stable();
    expect(
      page.element.querySelector('[data-qa="deletion-running"]')
    ).toBeNull();
    expect(page.button('sign-in')).not.toBeNull();
  });

  it('says when choices made during sign-in stay on the device for the next start', async () => {
    const service = new FakeAccountService();
    const local = new LocalSelection(undefined);
    let team = 201500;
    service.onEveryTakeover = () => local.follow(team++);
    const { button, stable, element } = await openPage({ service, local });

    button('sign-in')?.click();
    await stable();

    expect(
      element.querySelector('[data-qa="device-kept"]')?.textContent?.trim()
    ).toBe(
      'Einige Änderungen dieses Geräts sind noch nicht in deinem Konto. Sie bleiben auf dem Gerät und kommen beim nächsten Öffnen der App dazu.'
    );
  });

  it("tells which of the device's choices did not fit into the account", async () => {
    const service = new FakeAccountService();
    service.leftOver = {
      teams: [9001, 9002],
      children: [{ personId: 4711 }],
      clubColors: [],
    };
    const { button, stable, element } = await openPage({ service });

    button('sign-in')?.click();
    await stable();

    expect(
      element.querySelector('[data-qa="not-taken-over"]')?.textContent?.trim()
    ).toBe(
      '2 Teams und 1 Kind dieses Geräts passten nicht mehr in dein Konto: Es hält höchstens 50 Teams und 20 Kinder.'
    );
  });

  it('says so when the sign-in did not work', async () => {
    const service = new FakeAccountService();
    service.takeoverFails = true;
    const { button, stable, error } = await openPage({ service });

    button('sign-in')?.click();
    await stable();

    expect(error()).toBe(
      'Die Anmeldung hat nicht geklappt. Bitte noch einmal versuchen.'
    );
  });

  it('signs out, back to the sign-in', async () => {
    const { button, stable, service } = await signedIn();

    button('sign-out')?.click();
    await stable();

    expect(service.calls).toContain('signOut');
    expect(button('sign-in')).not.toBeNull();
  });

  it('keeps the account where its changes have not been sent, and says so', async () => {
    const service = new FakeAccountService();
    const page = await signedIn(service);
    service.notSent = true;

    page.button('sign-out')?.click();
    await page.stable();

    expect(page.error()).toBe(
      'Noch sind nicht alle Änderungen bei deinem Konto angekommen. Melde dich ab, sobald du wieder online bist.'
    );
    expect(page.button('sign-out')).not.toBeNull();
  });

  it('deletes the account once confirmed: Google asked first, then its document', async () => {
    const { button, stable, service } = await signedIn();

    button('delete-account')?.click();
    await stable();
    inDialog('delete-account-confirm');
    await stable();

    expect(service.calls.slice(0, 3)).toEqual([
      'reauthenticate',
      'deleteSelection uid-1',
      'deleteAuthUser uid-1',
    ]);
    expect(document.querySelector('korb-delete-account-dialog')).toBeNull();
    expect(button('sign-in')).not.toBeNull();
  });

  it('deletes nothing where the Elternteil cancels', async () => {
    const { button, stable, service } = await signedIn();

    button('delete-account')?.click();
    await stable();
    inDialog('cancel');
    await stable();

    expect(service.calls).toEqual([]);
    expect(document.querySelector('korb-delete-account-dialog')).toBeNull();
    expect(button('sign-out')).not.toBeNull();
  });

  it.each([
    [
      'Google was cancelled',
      (service: FakeAccountService) => (service.cancelled = true),
      'Das Konto ist nicht gelöscht: Die Bestätigung bei Google wurde abgebrochen.',
    ],
  ])(
    'says why the account is not deleted where %s',
    async (_, interfere, text) => {
      const service = new FakeAccountService();
      const page = await signedIn(service);
      interfere(service);

      page.button('delete-account')?.click();
      await page.stable();
      inDialog('delete-account-confirm');
      await page.stable();

      expect(page.error()).toBe(text);
      expect(page.button('sign-out')).not.toBeNull();
    }
  );

  it('deletes nothing offline, and says so', async () => {
    let online = true;
    const page = await signedIn(undefined, () => online);
    online = false;

    page.button('delete-account')?.click();
    await page.stable();
    inDialog('delete-account-confirm');
    await page.stable();

    expect(page.service.calls).toEqual([]);
    expect(page.error()).toBe(
      'Ohne Internet lässt sich das Konto nicht löschen. Bitte versuche es mit Internet noch einmal.'
    );
  });
});

describe('nichtUebernommenText', () => {
  it('says nothing where all fitted', () => {
    expect(
      notTakenOverText({ teams: [], children: [], clubColors: [] })
    ).toBeUndefined();
  });

  it('names one Team in the singular', () => {
    expect(
      notTakenOverText({ teams: [313036], children: [], clubColors: [] })
    ).toBe(
      '1 Team dieses Geräts passte nicht mehr in dein Konto: Es hält höchstens 50 Teams.'
    );
  });

  it('names Vereinsfarben among the rest, the verb in the plural', () => {
    expect(
      notTakenOverText({
        teams: [313036],
        children: [],
        clubColors: [{ clubId: 4242, primary: '#c8102e' }],
      })
    ).toBe(
      '1 Team und die Farben eines Vereins dieses Geräts passten nicht mehr in dein Konto: Es hält höchstens 50 Teams und die Farben von 50 Vereinen.'
    );
    expect(
      notTakenOverText({
        teams: [],
        children: [],
        clubColors: [
          { clubId: 4242, primary: '#c8102e' },
          { clubId: 4343, primary: '#1d4ed8' },
        ],
      })
    ).toBe(
      'Die Farben von 2 Vereinen dieses Geräts passten nicht mehr in dein Konto: Es hält höchstens die Farben von 50 Vereinen.'
    );
  });
});
