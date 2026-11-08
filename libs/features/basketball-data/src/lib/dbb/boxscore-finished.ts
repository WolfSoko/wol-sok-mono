import { DbbObject } from './dbb-object';
import { readEnvelope } from './envelope';
import { mapSpiel } from './map-spiel';
import { mapSpielbericht } from './map-spielbericht';

/**
 * Whether a DBB boxscore response (`match/id/{id}/boxscore`) is the
 * Spielbericht of a played Spiel: a result and a Kader listed. Past that,
 * the DBB rarely changes it, so the app's proxy lets the CDN keep it
 * longer. Any other response, an error or no Spielbericht yet, is not.
 */
export function dbbBoxscoreFinished(response: unknown): boolean {
  try {
    const data = readEnvelope(response);
    return (
      mapSpiel(DbbObject.of(data, 'boxscore')).status.art === 'gespielt' &&
      mapSpielbericht(data) !== undefined
    );
  } catch {
    return false;
  }
}
