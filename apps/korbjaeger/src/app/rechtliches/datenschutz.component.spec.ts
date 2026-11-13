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
import { DatenschutzComponent } from './datenschutz.component';
import { GERAETE_SCHLUESSEL } from './geraete-schluessel';
import { germanDays } from './german-days';

describe('DatenschutzComponent', () => {
  function abschnitt(seite: HTMLElement, id: string): string {
    const ueberschrift = seite.querySelector(`h2#${id}`);
    expect(ueberschrift).not.toBeNull();
    const teile: string[] = [];
    for (
      let element = ueberschrift?.nextElementSibling;
      element && element.tagName !== 'H2';
      element = element.nextElementSibling
    ) {
      teile.push(element.textContent ?? '');
    }
    return teile.join(' ').replace(/\s+/g, ' ');
  }

  it('names the controller and how email reaches them', () => {
    const seite = show(DatenschutzComponent);

    expect(seite.querySelector('h1')?.textContent?.trim()).toBe(
      'Datenschutzerklärung'
    );
    // what SiteOwnerComponent shows is the Impressum spec's to check
    expect(seite.querySelector('wolsok-site-owner')).not.toBeNull();
    expect(seite.querySelector('wolsok-email-forwarding')).not.toBeNull();
  });

  it('names every key the app keeps in the device’s storage, and its caps', () => {
    const geraet = abschnitt(show(DatenschutzComponent), 'geraet');

    for (const schluessel of Object.values(GERAETE_SCHLUESSEL)) {
      expect(geraet).toContain(schluessel);
    }
    const zeichen = new Intl.NumberFormat('de-DE').format(
      ANSWER_LIMITS.characters
    );
    expect(geraet).toContain(
      `Höchstens ${ANSWER_LIMITS.entries} Antworten mit zusammen höchstens ${zeichen} Zeichen, jede höchstens ${MAX_AGE_DAYS} Tage lang`
    );
  });

  // #2983: the keys of before #2966 are removed at start
  it('says the keys of an earlier version are removed', () => {
    const geraet = abschnitt(show(DatenschutzComponent), 'geraet');

    expect(geraet).toContain(KEYS_BEFORE_ENGLISH_NAMES.selection);
    expect(geraet).toContain('löscht die App beim Start');
  });

  it('names the entries Firebase keeps in localStorage while signed in', () => {
    const geraet = abschnitt(show(DatenschutzComponent), 'geraet');

    // Firestore's tab manager (persistentMultipleTabManager) and Auth's
    // fallback persistence (browserLocalPersistence)
    expect(geraet).toContain('firestore_');
    expect(geraet).toContain('firebase:');
  });

  it('says what the account’s document holds, its caps and where it lies', () => {
    const konto = abschnitt(show(DatenschutzComponent), 'konto');

    expect(konto).toContain(`${SELECTION_LIMITS.teams} Teams`);
    expect(konto).toContain(`${SELECTION_LIMITS.children} Kinder`);
    expect(konto).toContain(
      `die Farben von ${SELECTION_LIMITS.clubColors} Vereinen`
    );
    expect(konto).toContain(`${NICKNAME_LENGTH} Zeichen`);
    const { firestore } = REGIONS;
    expect(konto).toContain(`${firestore.id} (${firestore.place})`);
    expect(konto).toContain('Google');
  });

  it('covers the DBB as the source, the proxy and the hosting', () => {
    const seite = show(DatenschutzComponent);

    const dbb = abschnitt(seite, 'dbb');
    expect(dbb).toContain('basketball-bund.net');
    const { function: nitro } = REGIONS;
    expect(dbb).toContain(`${nitro.id} (${nitro.place})`);
    expect(dbb).toContain(`bis zu ${PROXY_CACHE_SECONDS.cdn / 60} Minuten`);
    expect(dbb).toContain(
      `bis zu ${PROXY_CACHE_SECONDS.cdnFinishedGameReport / 60} Minuten`
    );
    expect(abschnitt(seite, 'hosting')).toContain('Firebase Hosting');
  });

  it('covers the club index: its source, no persons, the search on the device, its renewal and its cache times', () => {
    const dbb = abschnitt(show(DatenschutzComponent), 'dbb');

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
    const loeschen = abschnitt(show(DatenschutzComponent), 'loeschen');

    expect(loeschen).toContain('Einstellungen');
    expect(loeschen).toContain('Konto löschen');
  });

  // korbjaeger-functions' `accountDeleted` (#2912): the tombstone first,
  // then the document; retried by Cloud Functions, the tombstone deleted by
  // Firestore's TTL
  it('says what the server deletes once the account is gone, and what it keeps', () => {
    const loeschen = abschnitt(show(DatenschutzComponent), 'loeschen');

    expect(loeschen).toContain(
      `bis zu ${germanDays(DELETION_RETRY_DAYS)} lang erneut`
    );
    expect(loeschen).toContain(
      `noch ${germanDays(TOMBSTONE_DAYS)} lang, ohne deine Auswahl`
    );
    expect(loeschen).toContain(
      `spätestens ${germanDays(TTL_DELETION_DAYS, { further: true })} später`
    );
    // the published wording for today's values, pinned
    expect(loeschen).toContain(
      'versucht er es bis zu 7 Tage lang erneut. Damit dieses Gerät danach nichts mehr speichern kann, behält er nur die Kennung deines Kontos noch einen Tag lang, ohne deine Auswahl; danach löscht die Datenbank sie von selbst, spätestens einen weiteren Tag später.'
    );
    expect(loeschen).toContain(REGIONS.firestore.id);
    expect(loeschen).not.toContain('E-Mail');
  });

  it('tells Google’s own part from what it processes for us', () => {
    const usa = abschnitt(show(DatenschutzComponent), 'usa');

    expect(usa).toContain('Auftragsverarbeiter');
    expect(usa).toContain('Google selbst verantwortlich');
    expect(usa).toContain('Weiterleitungsdienst');
  });

  it('links the legal notice', () => {
    expect(
      show(DatenschutzComponent).querySelector('a[href="/impressum"]')
    ).not.toBeNull();
  });
});
