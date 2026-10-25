import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
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
    // Kept 30 days after the match, as the functions' REPLAY_TTL_MS.
    expect(de).toContain('30 Tage nach dem Match');
    expect(en).toContain('30 days after the match');
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
