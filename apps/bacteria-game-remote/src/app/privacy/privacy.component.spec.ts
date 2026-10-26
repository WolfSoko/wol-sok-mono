import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { GameAds } from '@wolsok/feat-lazy-bac-game';
import { PrivacyComponent } from './privacy.component';

describe('PrivacyComponent', () => {
  let scrolledTo: string[];

  beforeEach(() => {
    scrolledTo = [];
    // jsdom has no layout, so no scrollIntoView either.
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolledTo.push(this.id);
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'privacy', component: PrivacyComponent },
          { path: '**', children: [] },
        ]),
      ],
    });
  });

  async function open(url = '/privacy'): Promise<HTMLElement> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, PrivacyComponent);
    return harness.routeNativeElement as HTMLElement;
  }

  it('is in German and English, and says whom to write to', async () => {
    const page = await open();

    expect(page.querySelector('article[lang="de"] h1')?.textContent).toBe(
      'Datenschutzerklärung'
    );
    expect(page.querySelector('article[lang="en"] h1')?.textContent).toBe(
      'Privacy policy'
    );
    expect(page.querySelector('address')?.textContent).toContain(
      'privacy@wolsok.de'
    );
  });

  it('has each section on the cloud in both languages', async () => {
    const page = await open();
    const pairs = [
      ['de-profil', 'en-profile'],
      ['de-online', 'en-online'],
      ['de-matches', 'en-matches'],
      ['de-galerie', 'en-gallery'],
      ['de-bestenliste', 'en-leaderboard'],
      ['de-moderation', 'en-moderation'],
      ['de-grundlage', 'en-basis'],
    ];

    for (const [de, en] of pairs) {
      expect(page.querySelector(`article[lang="de"] #${de}`)).not.toBeNull();
      expect(page.querySelector(`article[lang="en"] #${en}`)).not.toBeNull();
    }
  });

  it("names the profile's leaderboard switches by their labels", async () => {
    const page = await open();
    const de = page.querySelector('article[lang="de"]')?.textContent ?? '';
    const en = page.querySelector('article[lang="en"]')?.textContent ?? '';

    for (const label of [
      'Meinen Namen öffentlich zeigen',
      'Mich aus den Bestenlisten heraushalten',
      'Meine Matches aus der öffentlichen Galerie heraushalten',
    ]) {
      expect(de).toContain(label);
    }
    for (const label of [
      'Show my name in public',
      'Keep me off the leaderboards',
      'Keep my matches out of the public gallery',
    ]) {
      expect(en).toContain(label);
    }
    // The switch replaced writing to us, and the game shows the boards now.
    expect(de).not.toContain('Willst du nicht in der Bestenliste stehen');
    expect(en).not.toContain('If you do not want to be on the leaderboard');
    expect(de).not.toContain('zeigt die Bestenliste noch nicht');
    expect(en).not.toContain('does not show the leaderboard yet');
  });

  it('no longer says that only you see your name', async () => {
    const page = await open();

    expect(page.querySelector('article[lang="de"]')?.textContent).not.toContain(
      'andere Spieler sehen ihn nicht'
    );
    expect(page.querySelector('article[lang="en"]')?.textContent).not.toContain(
      'other players never see it'
    );
  });

  it('says a Google account that played elsewhere leaves the guest behind', async () => {
    const page = await open();
    const de = page.querySelector('article[lang="de"]')?.textContent ?? '';
    const en = page.querySelector('article[lang="en"]')?.textContent ?? '';

    expect(de).not.toContain('Das Gastkonto wird so zu deinem Google-Konto');
    expect(de).toContain('übernimmt das Google-Konto den Fortschritt');
    expect(en).not.toContain('Your guest account becomes your Google account');
    expect(en).toContain('the Google account takes over the guest');
  });

  it("says the game records and uploads matches now, by the settings' labels", async () => {
    const page = await open();
    const de = page.querySelector('article[lang="de"]')?.textContent ?? '';
    const en = page.querySelector('article[lang="en"]')?.textContent ?? '';

    // The uploads started with cloud replays (ADR 0011).
    expect(de).not.toContain('Das Spiel lädt sie nicht hoch');
    expect(de).not.toContain('Das Spiel lädt keine Matches hoch');
    expect(en).not.toContain('The game does not upload them');
    expect(en).not.toContain('The game uploads no matches');
    for (const label of [
      'Matches gegen den Computer aufzeichnen',
      'Meine Matches speichern',
      'Meine Matches',
    ]) {
      expect(de).toContain(label);
    }
    for (const label of [
      'Record matches against the computer',
      'Save my matches',
      'My matches',
    ]) {
      expect(en).toContain(label);
    }
    // Kept 30 days after saving, as the functions' REPLAY_TTL_MS.
    expect(de).toContain('30 Tage nach dem Speichern');
    expect(en).toContain('30 days after it was saved');
    // A submission expires a day after the client wrote it (COMMAND_TTL_MS).
    expect(de.replace(/\s+/g, ' ')).toContain(
      'nicht innerhalb eines Tages nach dem Match hochladen'
    );
    expect(en.replace(/\s+/g, ' ')).toContain(
      'cannot upload within a day after the match'
    );
  });

  it("says what a ranked attempt stores, by the switches' labels", async () => {
    const page = await open();
    const de = (
      page.querySelector('article[lang="de"]')?.textContent ?? ''
    ).replace(/\s+/g, ' ');
    const en = (
      page.querySelector('article[lang="en"]')?.textContent ?? ''
    ).replace(/\s+/g, ' ');

    // The game declares ranked attempts now (ADR 0012).
    expect(de).not.toContain('solange das Spiel keine gewerteten Versuche');
    expect(en).not.toContain('as long as the game declares no ranked attempts');
    for (const label of ['Gewerteter Versuch', 'Gewerteter Lauf']) {
      expect(de).toContain(label);
    }
    for (const label of ['Ranked attempt', 'Ranked run']) {
      expect(en).toContain(label);
    }
    // Kept 31 days, as ATTEMPT_DAYS; uploaded within 5 minutes.
    expect(de).toContain('Er läuft nach 31 Tagen ab');
    expect(en).toContain('It expires after 31 days');
    expect(de).toContain('bis 5 Minuten nach dem Match');
    expect(en).toContain('within 5 minutes after the match');
    // Ranked matches are uploaded whatever the settings say.
    expect(de).toContain(
      'Gewertete Matches auf dem Tageslevel und in Endlos-Läufen lädt es immer hoch'
    );
    expect(en).toContain('It always uploads ranked matches');
  });

  it('says how the game follows a suspension, and what dismissing a notice does', async () => {
    const page = await open();
    const de = (
      page.querySelector('article[lang="de"]')?.textContent ?? ''
    ).replace(/\s+/g, ' ');
    const en = (
      page.querySelector('article[lang="en"]')?.textContent ?? ''
    ).replace(/\s+/g, ' ');

    expect(de).toContain('ihr Ende in der Realtime Database');
    expect(en).toContain('its end in the Realtime Database');
    expect(de).toContain(
      'hält es zurück und speichert es, wenn die Sperre endet'
    );
    expect(en).toContain('holds back and saves once the suspension ends');
    expect(de).toContain('schließt du einen, löscht es ihn');
    expect(en).toContain('dismissing one deletes it');
  });

  function texts(page: HTMLElement): { de: string; en: string } {
    const text = (lang: string) =>
      (page.querySelector(`article[lang="${lang}"]`)?.textContent ?? '')
        .replace(/\s+/g, ' ')
        .trim();
    return { de: text('de'), en: text('en') };
  }

  describe('the ad consent', () => {
    let ads: { consentAnswered: ReturnType<typeof signal<boolean>> };
    let openConsentSettings: jest.Mock;

    beforeEach(() => {
      openConsentSettings = jest.fn();
      ads = { consentAnswered: signal(false) };
      TestBed.overrideProvider(GameAds, {
        useValue: { ...ads, openConsentSettings },
      });
    });

    function adButtons(page: HTMLElement): HTMLButtonElement[] {
      return [...page.querySelectorAll<HTMLButtonElement>('.ad-settings')];
    }

    it('names the button that changes it, with clearing the data as the fallback', async () => {
      const { de, en } = texts(await open());

      expect(de).toContain(
        'mit dem Button „Datenschutz-Einstellungen für Anzeigen“'
      );
      expect(en).toContain('with the button “Ad privacy settings”');
      expect(de).toContain('Erscheint er nicht');
      expect(en).toContain('If it does not show');
      expect(de).toContain('lösche die gespeicherten Daten der Seite');
      expect(en).toContain("clear the site's stored data");
    });

    it('offers the button only once the consent window answered', async () => {
      const page = await open();
      expect(adButtons(page)).toEqual([]);

      ads.consentAnswered.set(true);
      TestBed.tick();

      const [de, en] = adButtons(page);
      expect(de.closest('article')?.lang).toBe('de');
      expect(de.textContent?.trim()).toBe(
        'Datenschutz-Einstellungen für Anzeigen'
      );
      expect(en.closest('article')?.lang).toBe('en');
      expect(en.textContent?.trim()).toBe('Ad privacy settings');
      en.click();
      expect(openConsentSettings).toHaveBeenCalled();
    });
  });

  it('says what an account deletion erases, and that recorded matches stay anonymised', async () => {
    const { de, en } = texts(await open());

    // The functions erase it all by themselves (ADR 0012, 2026-10-26).
    expect(de).toContain(
      'Mit dem Konto löschen unsere Funktionen automatisch alle personenbezogenen Daten'
    );
    expect(en).toContain(
      'With the account our functions delete all personal data about it by themselves'
    );
    for (const item of [
      'deine Freundschaften auf beiden Seiten',
      'deinen Eintrag in der Warteschlange',
      'deine offenen Räume',
      'deinen Online-Status',
      'die Hinweise der Moderation',
      'deine Einträge in den Bestenlisten',
    ]) {
      expect(de).toContain(item);
    }
    for (const item of [
      'your friendships on both sides',
      'your entry in the queue',
      'your open rooms',
      'your online status',
      'the moderation notices',
      'your leaderboard entries',
    ]) {
      expect(en).toContain(item);
    }
    expect(de).toContain(
      'Deine aufgezeichneten Matches bleiben für die Statistik, aber ohne deine Kennung und ohne deinen Namen'
    );
    expect(en).toContain(
      'Your recorded matches stay for the statistics, but without your identifier and your name'
    );
    // Replays are no longer deleted with the account.
    expect(de).not.toContain('deren einziger Spieler du warst');
    expect(en).not.toContain('you were the only player of');
  });

  it('says idle guest accounts go after 90 days', async () => {
    const { de, en } = texts(await open());

    expect(de).toContain(
      'Ein Gastkonto, das 90 Tage lang nicht genutzt wurde, löschen unsere Funktionen automatisch'
    );
    expect(en).toContain(
      'Our functions delete a guest account unused for 90 days by themselves'
    );
    expect(de).toContain('beginnst du als neuer Gast');
    expect(en).toContain('you start as a new guest');
    expect(de).not.toContain('bis wir es löschen');
    expect(en).not.toContain('until we delete it');
  });

  it('says what deleting a match in My matches does', async () => {
    const { de, en } = texts(await open());

    expect(de).toContain(
      'Löschst du ein Match, nehmen unsere Funktionen deine Kennung'
    );
    expect(en).toContain(
      'If you delete a match, our functions take your identifier out'
    );
    expect(de).toContain('bleibt nur ohne deine Kennung');
    expect(en).toContain('stays stored only without your identifier');
  });

  it('says only friends can read the online status', async () => {
    const { de, en } = texts(await open());

    expect(de).toContain(
      'Lesen können den Eintrag nur Spieler, die du als Freund führst'
    );
    expect(en).toContain(
      'Only players you list as a friend can read the entry'
    );
    // The rule lets only `statusReaders` read `status/{uid}` now.
    expect(de).not.toContain('Technisch lesen kann den Eintrag jeder');
    expect(en).not.toContain('any signed-in player who knows your identifier');
  });

  it('names the hint on saved matches among what the device keeps', async () => {
    const { de, en } = texts(await open());

    expect(de).toContain('wo du das Speichern deiner Matches ausschaltest');
    expect(en).toContain('where to turn off saving your matches');
  });

  it('names Sentry and what an error report holds, in both languages', async () => {
    const page = await open();
    expect(page.querySelector('article[lang="de"] #de-fehler')).not.toBeNull();
    expect(page.querySelector('article[lang="en"] #en-errors')).not.toBeNull();
    const { de, en } = texts(page);
    const provider =
      'Functional Software, Inc., 45 Fremont Street, 8th Floor, San Francisco, CA 94105, USA';

    expect(de).toContain(provider);
    expect(en).toContain(provider);
    expect(de).toContain('ohne den Teil nach „?“ und „#“');
    expect(en).toContain('without the part after “?” and “#”');
    expect(de).toContain('Konto-Kennungen enthält ein Bericht nicht');
    expect(en).toContain(
      'A report holds no name, email address or account identifier'
    );
    expect(de).toContain('Interesse ist ein Spiel, das funktioniert');
    expect(en).toContain('our legitimate interest in a game that works');
    expect(de).toContain('löscht sie nach 90 Tagen');
    expect(en).toContain('deletes them after 90 days');
  });

  it('numbers its sections alike in both languages, and refers to them so', async () => {
    const page = await open();
    const numbers = (lang: string) =>
      [...page.querySelectorAll(`article[lang="${lang}"] h2`)].map(
        (h2) => h2.textContent?.split('.')[0]
      );
    const expected = Array.from({ length: 14 }, (_, i) => `${i + 1}`);

    expect(numbers('de')).toEqual(expected);
    expect(numbers('en')).toEqual(expected);
    const { de, en } = texts(page);
    // Deleting the account is section 11 now.
    expect(de).toContain('wie in Abschnitt 11');
    expect(en).toContain('in section 11');
    // Every reference to section 10 means the error reports, its only
    // content; one that says how to delete data points to 11.
    for (const text of [de, en]) {
      expect(text).not.toMatch(/(Abschnitt|section) 10\s+(explains|steht)/i);
    }
    expect(en).toContain('Section 11 explains how to have it deleted');
  });

  it('has its own title while open', async () => {
    await open();

    expect(TestBed.inject(Title).getTitle()).toBe(
      'Datenschutz - Bacteria Wars'
    );
  });

  it('scrolls to the section a link names', async () => {
    await open('/privacy#en-delete');

    expect(scrolledTo).toContain('en-delete');
  });

  it('scrolls to a language on every click, the same one again too', async () => {
    const page = await open('/privacy#de');
    scrolledTo = [];

    page.querySelector<HTMLAnchorElement>('nav a[hreflang="de"]')?.click();

    expect(scrolledTo).toEqual(['de']);
  });
});
