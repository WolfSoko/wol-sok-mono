export type AnalyticsValue = string | number | boolean;

/** Event parameters or user properties; null and undefined are left out. */
export type AnalyticsParams = Readonly<
  Record<string, AnalyticsValue | null | undefined>
>;

/**
 * Where an app's usage events go. Provided only where analytics runs
 * (`provideFirebaseAnalytics`): inject it optionally, without it the events
 * go nowhere. Nothing that identifies a person belongs in a name or a value,
 * no account or document ids and no text people typed.
 */
export abstract class Analytics {
  /**
   * A GA4 event: one of Google's recommended events (`login`, `share`,
   * `level_end`, ...) or a snake_case name of at most 40 characters.
   */
  public abstract track(name: string, params?: AnalyticsParams): void;
  /** A view without a URL of its own, such as a game's menu screen. */
  public abstract screenView(screen: string): void;
  /** Properties of the visitor's setup, sent with every later event. */
  public abstract setUserProperties(properties: AnalyticsParams): void;
}
