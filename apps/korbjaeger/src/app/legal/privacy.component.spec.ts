import {
  CLUB_INDEX_CACHE_SECONDS,
  PROXY_CACHE_SECONDS,
} from '../../shared/proxy-cache';
import { REGIONS } from '../../shared/regions';
import { show } from '../../testing/show';
import {
  CLUB_INDEX_CRAWL_DAYS,
  DELETION_RETRY_DAYS,
  TOMBSTONE_DAYS,
  TTL_DELETION_DAYS,
} from '@wolsok/feat-shared-korbjaeger-account';
import {
  SELECTION_LIMITS,
  NICKNAME_LENGTH,
} from '@wolsok/feat-korbjaeger-selection';
import { ANSWER_LIMITS, MAX_AGE_DAYS } from '@wolsok/feat-korbjaeger-answers';
import { KEYS_BEFORE_ENGLISH_NAMES } from '../keys-before-english-names';
import { PrivacyComponent } from './privacy.component';
import { DEVICE_KEYS } from './device-keys';
import { germanDays } from './german-days';

describe('PrivacyComponent', () => {
  function section(page: HTMLElement, id: string): string {
    const heading = page.querySelector(`h2#${id}`);
    expect(heading).not.toBeNull();
    const parts: string[] = [];
    for (
      let element = heading?.nextElementSibling;
      element && element.tagName !== 'H2';
      element = element.nextElementSibling
    ) {
      parts.push(element.textContent ?? '');
    }
    return parts.join(' ').replace(/\s+/g, ' ');
  }

  it('names the controller and how email reaches them', () => {
    const page = show(PrivacyComponent);

    expect(page.querySelector('h1')?.textContent?.trim()).toBe(
      'Datenschutzerklärung'
    );
    // what SiteOwnerComponent shows is the Impressum spec's to check
    expect(page.querySelector('wolsok-site-owner')).not.toBeNull();
    expect(page.querySelector('wolsok-email-forwarding')).not.toBeNull();
  });

  it('names every key the app keeps in the device’s storage, and its caps', () => {
    const device = section(show(PrivacyComponent), 'geraet');

    for (const keys of Object.values(DEVICE_KEYS)) {
      expect(device).toContain(keys);
    }
    const characters = new Intl.NumberFormat('de-DE').format(
      ANSWER_LIMITS.characters
    );
    expect(device).toContain(
      `Höchstens ${ANSWER_LIMITS.entries} Antworten mit zusammen höchstens ${characters} Zeichen, jede höchstens ${MAX_AGE_DAYS} Tage lang`
    );
  });

  // #2983: the keys of before #2966 are removed at start
  it('says the keys of an earlier version are removed', () => {
    const device = section(show(PrivacyComponent), 'geraet');

    expect(device).toContain(KEYS_BEFORE_ENGLISH_NAMES.selection);
    expect(device).toContain('löscht die App beim Start');
  });

  it('names the entries Firebase keeps in localStorage while signed in', () => {
    const device = section(show(PrivacyComponent), 'geraet');

    // Firestore's tab manager (persistentMultipleTabManager) and Auth's
    // fallback persistence (browserLocalPersistence)
    expect(device).toContain('firestore_');
    expect(device).toContain('firebase:');
  });

  it('says what the account’s document holds, its caps and where it lies', () => {
    const account = section(show(PrivacyComponent), 'konto');

    expect(account).toContain(`${SELECTION_LIMITS.teams} Teams`);
    expect(account).toContain(`${SELECTION_LIMITS.children} Kinder`);
    expect(account).toContain(
      `die Farben von ${SELECTION_LIMITS.clubColors} Vereinen`
    );
    expect(account).toContain(`${NICKNAME_LENGTH} Zeichen`);
    const { firestore } = REGIONS;
    expect(account).toContain(`${firestore.id} (${firestore.place})`);
    expect(account).toContain('Google');
  });

  it('covers the DBB as the source, the proxy and the hosting', () => {
    const page = show(PrivacyComponent);

    const dbb = section(page, 'dbb');
    expect(dbb).toContain('basketball-bund.net');
    const { function: nitro } = REGIONS;
    expect(dbb).toContain(`${nitro.id} (${nitro.place})`);
    expect(dbb).toContain(`bis zu ${PROXY_CACHE_SECONDS.cdn / 60} Minuten`);
    expect(dbb).toContain(
      `bis zu ${PROXY_CACHE_SECONDS.cdnFinishedGameReport / 60} Minuten`
    );
    expect(section(page, 'hosting')).toContain('Firebase Hosting');
  });

  it('covers the club index: its source, no persons, the search on the device, its renewal and its cache times', () => {
    const dbb = section(show(PrivacyComponent), 'dbb');

    const { firestore } = REGIONS;
    expect(dbb).toContain('Liste aller Vereine');
    expect(dbb).toContain(`Region ${firestore.id} (${firestore.place})`);
    expect(dbb).toContain('keine Personen');
    expect(dbb).toContain('verlässt dein Gerät nicht');
    const { complete, filling } = CLUB_INDEX_CACHE_SECONDS;
    expect(CLUB_INDEX_CRAWL_DAYS).toEqual({ maxAge: 7, retryAfter: 1 });
    expect(dbb).toContain(
      'Sie erneuert die Liste jedes Verbands in der Regel alle 7 Tage, nach einem Fehler schon einen Tag später.'
    );
    expect(dbb).toContain(
      `bis zu ${complete.cdn / 3600} Stunden vor, dein Browser bis zu ${complete.browser / 60} Minuten; solange darin noch Verbände fehlen, nur bis zu ${filling.cdn / 60} Minuten, dein Browser bis zu ${filling.browser} Sekunden.`
    );
  });

  it('says how to delete the account and its data', () => {
    const deletion = section(show(PrivacyComponent), 'loeschen');

    expect(deletion).toContain('Einstellungen');
    expect(deletion).toContain('Konto löschen');
  });

  // korbjaeger-functions' `accountDeleted` (#2912): the tombstone first,
  // then the document; retried by Cloud Functions, the tombstone deleted by
  // Firestore's TTL
  it('says what the server deletes once the account is gone, and what it keeps', () => {
    const deletion = section(show(PrivacyComponent), 'loeschen');

    expect(deletion).toContain(
      `bis zu ${germanDays(DELETION_RETRY_DAYS)} lang erneut`
    );
    expect(deletion).toContain(
      `noch ${germanDays(TOMBSTONE_DAYS)} lang, ohne deine Auswahl`
    );
    expect(deletion).toContain(
      `spätestens ${germanDays(TTL_DELETION_DAYS, { further: true })} später`
    );
    // the published wording for today's values, pinned
    expect(deletion).toContain(
      'versucht er es bis zu 7 Tage lang erneut. Damit dieses Gerät danach nichts mehr speichern kann, behält er nur die Kennung deines Kontos noch einen Tag lang, ohne deine Auswahl; danach löscht die Datenbank sie von selbst, spätestens einen weiteren Tag später.'
    );
    expect(deletion).toContain(REGIONS.firestore.id);
    expect(deletion).not.toContain('E-Mail');
  });

  it('tells Google’s own part from what it processes for us', () => {
    const usa = section(show(PrivacyComponent), 'usa');

    expect(usa).toContain('Auftragsverarbeiter');
    expect(usa).toContain('Google selbst verantwortlich');
    expect(usa).toContain('Weiterleitungsdienst');
  });

  it('links the legal notice', () => {
    expect(
      show(PrivacyComponent).querySelector('a[href="/impressum"]')
    ).not.toBeNull();
  });
});
