import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  EmailForwardingComponent,
  SiteOwnerComponent,
} from '@wolsok/shared-legal';
import { PROXY_CACHE_SEKUNDEN } from '../../shared/proxy-cache';
import { REGIONEN } from '../../shared/regionen';
import { SITE_HOST, SITE_URL } from '../../shared/site';
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
import { DBB_SEITE } from './dbb-seite';
import { IMPRESSUM_PFAD } from './rechtliche-pfade';

const TAG_MS = 24 * 60 * 60_000;

/**
 * The privacy policy, in German like the whole app (ADR 0019). The keys,
 * caps and ages it names come from the code that stores them, so a change
 * there changes the text too; a new kind of data needs a paragraph here.
 */
@Component({
  selector: 'korb-datenschutz',
  imports: [EmailForwardingComponent, RouterLink, SiteOwnerComponent],
  templateUrl: './datenschutz.component.html',
  styleUrl: './rechtliche-seite.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatenschutzComponent {
  protected readonly seite = SITE_URL;
  protected readonly host = SITE_HOST;
  protected readonly dbb = DBB_SEITE;
  protected readonly regionen = REGIONEN;
  protected readonly cdnMinuten = PROXY_CACHE_SEKUNDEN.cdn / 60;
  protected readonly spielberichtMinuten =
    PROXY_CACHE_SEKUNDEN.cdnFertigerSpielbericht / 60;
  protected readonly impressum = IMPRESSUM_PFAD;

  protected readonly schluessel = {
    auswahl: AUSWAHL_SCHLUESSEL,
    antwortIndex: ANTWORT_INDEX,
    antwortPraefix: ANTWORT_PRAEFIX,
    angemeldet: ANGEMELDET_SCHLUESSEL,
    zwischenspeicherLeeren: ZWISCHENSPEICHER_LEEREN_SCHLUESSEL,
    installationAbgelehnt: INSTALLATION_ABGELEHNT_SCHLUESSEL,
  } as const;
  protected readonly antwortTage = MAX_ALTER_MS / TAG_MS;
  protected readonly antwortAnzahl = ANTWORT_GRENZEN.eintraege;
  protected readonly grenzen = AUSWAHL_GRENZEN;
  protected readonly spitznameLaenge = SPITZNAME_LAENGE;
}
