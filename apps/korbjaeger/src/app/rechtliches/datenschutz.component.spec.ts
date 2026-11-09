import { PROXY_CACHE_SEKUNDEN } from '../../shared/proxy-cache';
import { REGIONS } from '../../shared/regions';
import { zeigen } from '../../testing/zeigen';
import {
  AUSWAHL_GRENZEN,
  SPITZNAME_LAENGE,
} from '@wolsok/feat-korbjaeger-auswahl';
import {
  ANTWORT_GRENZEN,
  MAX_ALTER_TAGE,
} from '../basketball-data/letzte-antworten';
import { DatenschutzComponent } from './datenschutz.component';
import { GERAETE_SCHLUESSEL } from './geraete-schluessel';

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
    const seite = zeigen(DatenschutzComponent);

    expect(seite.querySelector('h1')?.textContent?.trim()).toBe(
      'Datenschutzerklärung'
    );
    // what SiteOwnerComponent shows is the Impressum spec's to check
    expect(seite.querySelector('wolsok-site-owner')).not.toBeNull();
    expect(seite.querySelector('wolsok-email-forwarding')).not.toBeNull();
  });

  it('names every key the app keeps in the device’s storage, and its caps', () => {
    const geraet = abschnitt(zeigen(DatenschutzComponent), 'geraet');

    for (const schluessel of Object.values(GERAETE_SCHLUESSEL)) {
      expect(geraet).toContain(schluessel);
    }
    const zeichen = new Intl.NumberFormat('de-DE').format(
      ANTWORT_GRENZEN.zeichen
    );
    expect(geraet).toContain(
      `Höchstens ${ANTWORT_GRENZEN.eintraege} Antworten mit zusammen höchstens ${zeichen} Zeichen, jede höchstens ${MAX_ALTER_TAGE} Tage lang`
    );
  });

  it('names the entries Firebase keeps in localStorage while signed in', () => {
    const geraet = abschnitt(zeigen(DatenschutzComponent), 'geraet');

    // Firestore's tab manager (persistentMultipleTabManager) and Auth's
    // fallback persistence (browserLocalPersistence)
    expect(geraet).toContain('firestore_');
    expect(geraet).toContain('firebase:');
  });

  it('says what the account’s document holds, its caps and where it lies', () => {
    const konto = abschnitt(zeigen(DatenschutzComponent), 'konto');

    expect(konto).toContain(`${AUSWAHL_GRENZEN.teams} Teams`);
    expect(konto).toContain(`${AUSWAHL_GRENZEN.kinder} Kinder`);
    expect(konto).toContain(
      `die Farben von ${AUSWAHL_GRENZEN.vereinsfarben} Vereinen`
    );
    expect(konto).toContain(`${SPITZNAME_LAENGE} Zeichen`);
    const { firestore } = REGIONS;
    expect(konto).toContain(`${firestore.id} (${firestore.place})`);
    expect(konto).toContain('Google');
  });

  it('covers the DBB as the source, the proxy and the hosting', () => {
    const seite = zeigen(DatenschutzComponent);

    const dbb = abschnitt(seite, 'dbb');
    expect(dbb).toContain('basketball-bund.net');
    const { function: nitro } = REGIONS;
    expect(dbb).toContain(`${nitro.id} (${nitro.place})`);
    expect(dbb).toContain(`bis zu ${PROXY_CACHE_SEKUNDEN.cdn / 60} Minuten`);
    expect(dbb).toContain(
      `bis zu ${PROXY_CACHE_SEKUNDEN.cdnFertigerSpielbericht / 60} Minuten`
    );
    expect(abschnitt(seite, 'hosting')).toContain('Firebase Hosting');
  });

  it('says how to delete the account and its data', () => {
    const loeschen = abschnitt(zeigen(DatenschutzComponent), 'loeschen');

    expect(loeschen).toContain('Einstellungen');
    expect(loeschen).toContain('Konto löschen');
  });

  // korbjaeger-functions' `kontoGeloescht` (#2912): the tombstone first, a
  // day long, then the document; retried for up to 7 days
  it('says what the server deletes once the account is gone, and what it keeps', () => {
    const loeschen = abschnitt(zeigen(DatenschutzComponent), 'loeschen');

    expect(loeschen).toContain('bis zu 7 Tage');
    expect(loeschen).toContain('einen Tag');
    // Firestore's TTL deletes within a day after `expireAt`
    expect(loeschen).toContain('spätestens einen weiteren Tag später');
    expect(loeschen).toContain(REGIONS.firestore.id);
    expect(loeschen).not.toContain('E-Mail');
  });

  it('tells Google’s own part from what it processes for us', () => {
    const usa = abschnitt(zeigen(DatenschutzComponent), 'usa');

    expect(usa).toContain('Auftragsverarbeiter');
    expect(usa).toContain('Google selbst verantwortlich');
    expect(usa).toContain('Weiterleitungsdienst');
  });

  it('links the legal notice', () => {
    expect(
      zeigen(DatenschutzComponent).querySelector('a[href="/impressum"]')
    ).not.toBeNull();
  });
});
