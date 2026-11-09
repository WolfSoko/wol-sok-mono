import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SITE_OWNER } from '@wolsok/shared-legal';
import { PROXY_CACHE_SEKUNDEN } from '../../shared/proxy-cache';
import { REGIONEN } from '../../shared/regionen';
import { AUSWAHL_GRENZEN } from '../auswahl/auswahl-dokument';
import { SPITZNAME_LAENGE } from '../auswahl/kind';
import { AUSWAHL_SCHLUESSEL } from '../auswahl/lokale-auswahl';
import {
  ANTWORT_GRENZEN,
  ANTWORT_INDEX,
  ANTWORT_PRAEFIX,
  MAX_ALTER_MS,
} from '../basketball-data/letzte-antworten';
import {
  ANGEMELDET_SCHLUESSEL,
  INSTALLATION_ABGELEHNT_SCHLUESSEL,
  ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
} from '../geraete-speicher';
import { DatenschutzComponent } from './datenschutz.component';

describe('DatenschutzComponent', () => {
  function zeigen(): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DatenschutzComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

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

  it('names the controller from SITE_OWNER', () => {
    const seite = zeigen();

    expect(seite.querySelector('h1')?.textContent?.trim()).toBe(
      'Datenschutzerklärung'
    );
    const verantwortlicher = seite
      .querySelector('wolsok-site-owner address')
      ?.textContent?.replace(/\s+/g, ' ');
    expect(verantwortlicher).toContain(SITE_OWNER.name);
    expect(verantwortlicher).toContain(`E-Mail: ${SITE_OWNER.email}`);
    expect(seite.querySelector('wolsok-email-forwarding')).not.toBeNull();
  });

  it('names every key the app keeps in the device’s storage', () => {
    const geraet = abschnitt(zeigen(), 'geraet');

    for (const schluessel of [
      AUSWAHL_SCHLUESSEL,
      ANTWORT_INDEX,
      ANTWORT_PRAEFIX,
      ANGEMELDET_SCHLUESSEL,
      ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
      INSTALLATION_ABGELEHNT_SCHLUESSEL,
    ]) {
      expect(geraet).toContain(schluessel);
    }
    expect(geraet).toContain(`${MAX_ALTER_MS / (24 * 60 * 60_000)} Tage`);
    expect(geraet).toContain(
      `Höchstens ${ANTWORT_GRENZEN.eintraege} Antworten`
    );
  });

  it('names the entries Firebase keeps in localStorage while signed in', () => {
    const geraet = abschnitt(zeigen(), 'geraet');

    // Firestore's tab manager (persistentMultipleTabManager) and Auth's
    // fallback persistence (browserLocalPersistence)
    expect(geraet).toContain('firestore_');
    expect(geraet).toContain('firebase:');
  });

  it('says what the account’s document holds, its caps and where it lies', () => {
    const konto = abschnitt(zeigen(), 'konto');

    expect(konto).toContain(`${AUSWAHL_GRENZEN.teams} Teams`);
    expect(konto).toContain(`${AUSWAHL_GRENZEN.kinder} Kinder`);
    expect(konto).toContain(`${SPITZNAME_LAENGE} Zeichen`);
    const { firestore } = REGIONEN;
    expect(konto).toContain(`${firestore.id} (${firestore.ort})`);
    expect(konto).toContain('Google');
  });

  it('covers the DBB as the source, the proxy and the hosting', () => {
    const seite = zeigen();

    const dbb = abschnitt(seite, 'dbb');
    expect(dbb).toContain('basketball-bund.net');
    const { funktion } = REGIONEN;
    expect(dbb).toContain(`${funktion.id} (${funktion.ort})`);
    expect(dbb).toContain(`bis zu ${PROXY_CACHE_SEKUNDEN.cdn / 60} Minuten`);
    expect(dbb).toContain(
      `bis zu ${PROXY_CACHE_SEKUNDEN.cdnFertigerSpielbericht / 60} Minuten`
    );
    expect(abschnitt(seite, 'hosting')).toContain('Firebase Hosting');
  });

  it('says how to delete the account and its data', () => {
    const loeschen = abschnitt(zeigen(), 'loeschen');

    expect(loeschen).toContain('Einstellungen');
    expect(loeschen).toContain('Konto löschen');
  });

  it('tells Google’s own part from what it processes for us', () => {
    const usa = abschnitt(zeigen(), 'usa');

    expect(usa).toContain('Auftragsverarbeiter');
    expect(usa).toContain('Google selbst verantwortlich');
    expect(usa).toContain('Weiterleitungsdienst');
  });

  it('links the legal notice', () => {
    expect(zeigen().querySelector('a[href="/impressum"]')).not.toBeNull();
  });
});
