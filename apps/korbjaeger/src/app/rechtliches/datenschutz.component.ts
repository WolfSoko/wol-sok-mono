import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  EmailForwardingComponent,
  SiteOwnerComponent,
} from '@wolsok/shared-legal';
import {
  CLUB_INDEX_CACHE_SECONDS,
  PROXY_CACHE_SEKUNDEN,
} from '../../shared/proxy-cache';
import { REGIONS } from '../../shared/regions';
import { SITE_HOST, SITE_URL } from '../../shared/site';
import {
  DELETION_RETRY_DAYS,
  TOMBSTONE_DAYS,
  TTL_DELETION_DAYS,
} from '@wolsok/feat-shared-korbjaeger-account';
import {
  AUSWAHL_GRENZEN,
  SPITZNAME_LAENGE,
} from '@wolsok/feat-korbjaeger-auswahl';
import {
  ANTWORT_GRENZEN,
  MAX_ALTER_TAGE,
} from '@wolsok/feat-korbjaeger-antworten';
import { KEYS_BEFORE_ENGLISH_NAMES } from '../keys-before-english-names';
import { DbbLinkComponent } from './dbb-link.component';
import { germanDays } from './german-days';
import { GERAETE_SCHLUESSEL } from './geraete-schluessel';

/**
 * The privacy policy, in German like the whole app (ADR 0019). The keys,
 * caps and ages it names come from the code that stores them, so a change
 * there changes the text too; a new kind of data needs a paragraph here.
 */
@Component({
  selector: 'korb-datenschutz',
  imports: [
    DbbLinkComponent,
    EmailForwardingComponent,
    RouterLink,
    SiteOwnerComponent,
  ],
  templateUrl: './datenschutz.component.html',
  styleUrl: './rechtliche-seite.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatenschutzComponent {
  protected readonly seite = SITE_URL;
  protected readonly host = SITE_HOST;
  protected readonly regions = REGIONS;
  protected readonly cache = PROXY_CACHE_SEKUNDEN;
  protected readonly vereinsIndex = CLUB_INDEX_CACHE_SECONDS;
  protected readonly grenzen = AUSWAHL_GRENZEN;
  protected readonly spitznameLaenge = SPITZNAME_LAENGE;
  protected readonly antworten = {
    grenzen: ANTWORT_GRENZEN,
    zeichen: new Intl.NumberFormat('de-DE').format(ANTWORT_GRENZEN.zeichen),
    tage: MAX_ALTER_TAGE,
  } as const;
  protected readonly schluessel = GERAETE_SCHLUESSEL;
  protected readonly alteSchluessel = KEYS_BEFORE_ENGLISH_NAMES;
  /** How long section 6 says the server retries and keeps a tombstone. */
  protected readonly deletion = {
    retry: germanDays(DELETION_RETRY_DAYS),
    tombstone: germanDays(TOMBSTONE_DAYS),
    ttl: germanDays(TTL_DELETION_DAYS, { further: true }),
  } as const;
}
