import {
  inject,
  Injectable,
  InjectionToken,
  Injector,
  runInInjectionContext,
  signal,
} from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import type { Analytics as AnalyticsInstance } from 'firebase/analytics';
import { Analytics, AnalyticsParams } from './analytics';
import {
  GaParams,
  MAX_EVENT_PARAM_LENGTH,
  MAX_USER_PROPERTY_LENGTH,
  toGaParams,
} from './analytics-params';
import { ConsentChoice, ConsentPrompt } from './consent';
import {
  deleteAnalyticsCookies,
  loadChoice,
  saveChoice,
} from './consent-storage';

export interface FirebaseAnalyticsOptions {
  /** The `localStorage` key that keeps the visitor's choice. */
  readonly storageKey: string;
  /**
   * The Firebase app whose `measurementId` receives the events. Called in
   * an injection context, and only once the visitor consents.
   */
  readonly app: () => FirebaseApp | Promise<FirebaseApp>;
}

export const FIREBASE_ANALYTICS_OPTIONS =
  new InjectionToken<FirebaseAnalyticsOptions>('FIREBASE_ANALYTICS_OPTIONS');

/**
 * Events from before the choice is known, held in memory only and sent once
 * the visitor consents (dropped when they decline). Enough for a first visit
 * up to the answer, bounded for one that never answers.
 */
export const MAX_PENDING_COMMANDS = 50;

/**
 * Ads stay off whatever the visitor chose: no Google signals (cross-device
 * reports from signed-in Google accounts), no ad personalisation. Page views
 * come from the router (`trackPageViews`), with the route's pattern instead
 * of the URL.
 */
export const ANALYTICS_CONFIG = {
  send_page_view: false,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
} as const;

interface StartedSdk {
  readonly sdk: typeof import('firebase/analytics');
  readonly instance: AnalyticsInstance;
}

type Command = (started: StartedSdk) => void;

/** What the events say about the page they happened on. */
interface PageContext extends GaParams {
  page_location: string;
  page_path: string;
  page_title: string;
}

/**
 * Google Consent Mode for Firebase Analytics, in its basic form: the SDK and
 * gtag.js load only once the visitor has granted analytics storage. Ad
 * storage, ad user data and ad personalisation stay denied.
 */
@Injectable()
export class FirebaseAnalytics implements ConsentPrompt, Analytics {
  private readonly options = inject(FIREBASE_ANALYTICS_OPTIONS);
  private readonly injector = inject(Injector);
  private readonly askingState = signal(false);
  private readonly choiceState = signal<ConsentChoice | null>(null);
  private pending: Command[] = [];
  /** Null when the SDK can't run here (blocked, offline, no IndexedDB). */
  private started?: Promise<StartedSdk | null>;
  private page?: PageContext;

  public readonly asking = this.askingState.asReadonly();
  public readonly choice = this.choiceState.asReadonly();

  /** Applies the choice made on an earlier visit, or asks for one. */
  public restore(): void {
    const choice = loadChoice(this.options.storageKey);
    if (choice === null) {
      this.ask();
    } else {
      this.apply(choice);
    }
  }

  public ask(): void {
    this.askingState.set(true);
  }

  public decide(choice: ConsentChoice): void {
    this.askingState.set(false);
    saveChoice(this.options.storageKey, choice);
    this.apply(choice);
  }

  public track(name: string, params?: AnalyticsParams): void {
    const eventParams = {
      ...this.page,
      ...toGaParams(params, MAX_EVENT_PARAM_LENGTH),
    };
    this.send(({ sdk, instance }) => sdk.logEvent(instance, name, eventParams));
  }

  public screenView(screen: string): void {
    this.track('screen_view', {
      firebase_screen: screen,
      firebase_screen_class: screen,
    });
  }

  public setUserProperties(properties: AnalyticsParams): void {
    const userProperties = toGaParams(properties, MAX_USER_PROPERTY_LENGTH);
    this.send(({ sdk, instance }) =>
      sdk.setUserProperties(instance, userProperties)
    );
  }

  /**
   * A page view of `path`, a route's pattern. The later events, also those
   * gtag.js collects itself, name that page instead of the URL.
   */
  public pageView(path: string): void {
    const page: PageContext = {
      page_location: `${location.origin}${path}`,
      page_path: path,
      // the document's title may hold what people typed, a poll's question
      page_title: path,
    };
    this.page = page;
    this.send(({ sdk, instance }) => {
      sdk.setDefaultEventParameters(page);
      sdk.logEvent(instance, 'page_view', page);
    });
  }

  private send(command: Command): void {
    if (this.choiceState() === 'denied') return;
    if (this.started) {
      void this.started.then((started) => started && command(started));
    } else if (this.pending.length < MAX_PENDING_COMMANDS) {
      this.pending.push(command);
    }
  }

  private apply(choice: ConsentChoice): void {
    this.choiceState.set(choice);
    if (choice === 'denied') {
      this.pending = [];
    }
    if (this.started) {
      void this.started.then((started) => {
        if (!started) return;
        started.sdk.setConsent({ analytics_storage: choice });
        started.sdk.setAnalyticsCollectionEnabled(
          started.instance,
          choice === 'granted'
        );
        if (choice === 'denied') {
          deleteAnalyticsCookies();
        }
      });
    } else if (choice === 'granted') {
      this.started = this.start();
      const pending = this.pending;
      this.pending = [];
      pending.forEach((command) => this.send(command));
    } else {
      // left from before consent was asked for
      deleteAnalyticsCookies();
    }
  }

  /** Analytics is best effort: where it can't start, the events are dropped. */
  private async start(): Promise<StartedSdk | null> {
    try {
      const sdk = await import('firebase/analytics');
      if (!(await sdk.isSupported())) return null;
      // set before the instance exists, the SDK sends it as the consent
      // default ahead of its first hit; an update sent now would overtake it
      sdk.setConsent({
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      const app = await runInInjectionContext(this.injector, this.options.app);
      const instance = sdk.initializeAnalytics(app, {
        config: ANALYTICS_CONFIG,
      });
      return { sdk, instance };
    } catch {
      return null;
    }
  }
}
