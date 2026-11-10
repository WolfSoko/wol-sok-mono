import { Injectable, signal } from '@angular/core';

/**
 * The term typed into the club search, kept in memory while the app runs,
 * so back from a Verein finds the search as it was. Never in the URL or
 * the device's storage: the typed text stays on the device and goes with
 * the visit (ADR 0019).
 */
@Injectable({ providedIn: 'root' })
export class ClubSearchTerm {
  public readonly term = signal('');
}
