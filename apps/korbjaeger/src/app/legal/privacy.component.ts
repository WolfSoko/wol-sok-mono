import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  EmailForwardingComponent,
  SiteOwnerComponent,
} from '@wolsok/shared-legal';
import {
  CLUB_INDEX_CACHE_SECONDS,
  PROXY_CACHE_SECONDS,
} from '../../shared/proxy-cache';
import { REGIONS } from '../../shared/regions';
import { SITE_HOST, SITE_URL } from '../../shared/site';
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
import { DbbLinkComponent } from './dbb-link.component';
import { germanDays } from './german-days';
import { DEVICE_KEYS } from './device-keys';

/**
 * The privacy policy, in German like the whole app (ADR 0019). The keys,
 * caps and ages it names come from the code that stores them, so a change
 * there changes the text too; a new kind of data needs a paragraph here.
 */
@Component({
  selector: 'korb-privacy',
  imports: [
    DbbLinkComponent,
    EmailForwardingComponent,
    RouterLink,
    SiteOwnerComponent,
  ],
  templateUrl: './privacy.component.html',
  styleUrl: './legal-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent {
  protected readonly page = SITE_URL;
  protected readonly host = SITE_HOST;
  protected readonly regions = REGIONS;
  protected readonly cache = PROXY_CACHE_SECONDS;
  /** How long section 3 says the club index is kept and when it is renewed. */
  protected readonly clubIndex = {
    cache: CLUB_INDEX_CACHE_SECONDS,
    crawl: {
      maxAge: germanDays(CLUB_INDEX_CRAWL_DAYS.maxAge),
      retryAfter: germanDays(CLUB_INDEX_CRAWL_DAYS.retryAfter),
    },
  } as const;
  protected readonly limits = SELECTION_LIMITS;
  protected readonly nicknameLength = NICKNAME_LENGTH;
  protected readonly answers = {
    limits: ANSWER_LIMITS,
    characters: new Intl.NumberFormat('de-DE').format(ANSWER_LIMITS.characters),
    days: MAX_AGE_DAYS,
  } as const;
  protected readonly keys = DEVICE_KEYS;
  /** The key before #2966 the policy names as an example of what the start removes. */
  protected readonly oldSelectionKey = KEYS_BEFORE_ENGLISH_NAMES.selection;
  /** How long section 6 says the server retries and keeps a tombstone. */
  protected readonly deletion = {
    retry: germanDays(DELETION_RETRY_DAYS),
    tombstone: germanDays(TOMBSTONE_DAYS),
    ttl: germanDays(TTL_DELETION_DAYS, { further: true }),
  } as const;
}
