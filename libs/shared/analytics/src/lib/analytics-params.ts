import { AnalyticsParams } from './analytics';

/**
 * GA4's collection limits
 * (https://support.google.com/analytics/answer/9267744): longer values are
 * cut, parameters beyond the limit dropped by Google anyway.
 */
export const MAX_EVENT_PARAMS = 25;
export const MAX_EVENT_PARAM_LENGTH = 100;
export const MAX_USER_PROPERTY_LENGTH = 36;

export type GaParams = Record<string, string | number>;

/**
 * Parameters as GA4 stores them: strings and numbers. Booleans become
 * `'true'`/`'false'`, so a custom dimension reads them as text.
 */
export function toGaParams(
  params: AnalyticsParams | undefined,
  maxLength: number,
  maxParams = MAX_EVENT_PARAMS
): GaParams {
  const result: GaParams = {};
  let count = 0;
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined) continue;
    if (count++ === maxParams) break;
    result[key] =
      typeof value === 'number' ? value : String(value).slice(0, maxLength);
  }
  return result;
}
