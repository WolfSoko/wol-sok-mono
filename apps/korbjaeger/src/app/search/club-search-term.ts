import { Injectable, signal } from '@angular/core';

/**
 * The term typed into the Verein search, kept in memory for the visit, so
 * Back from a Verein's page shows the same hits. Never in the URL or a
 * request: a reload would send it to the server, and the typed text stays
 * on the device (privacy policy, section 3).
 */
@Injectable({ providedIn: 'root' })
export class ClubSearchTerm {
  public readonly value = signal('');
}
