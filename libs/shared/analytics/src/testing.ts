import { Provider } from '@angular/core';
import { Analytics, AnalyticsParams } from './lib/analytics';

export interface TrackedEvent {
  readonly name: string;
  readonly params?: AnalyticsParams;
}

/** Analytics that keeps what it is told, for specs (Jest and Vitest alike). */
export class RecordingAnalytics extends Analytics {
  public readonly events: TrackedEvent[] = [];
  public readonly screens: string[] = [];
  public readonly userProperties: AnalyticsParams[] = [];

  public track(name: string, params?: AnalyticsParams): void {
    this.events.push({ name, params });
  }

  public screenView(screen: string): void {
    this.screens.push(screen);
  }

  public setUserProperties(properties: AnalyticsParams): void {
    this.userProperties.push(properties);
  }

  /** The parameters of each event named `name`, in order. */
  public tracked(name: string): (AnalyticsParams | undefined)[] {
    return this.events
      .filter((event) => event.name === name)
      .map((event) => event.params);
  }
}

/** Provides `analytics` as the app's `Analytics`. */
export function provideRecordingAnalytics(
  analytics: RecordingAnalytics
): Provider {
  return { provide: Analytics, useValue: analytics };
}
