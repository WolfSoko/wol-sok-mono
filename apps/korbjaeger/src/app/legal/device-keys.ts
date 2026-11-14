import { SELECTION_KEY } from '@wolsok/feat-korbjaeger-selection';
import { ANSWER_INDEX, ANSWER_PREFIX } from '@wolsok/feat-korbjaeger-answers';
import {
  SIGNED_IN_KEY,
  APPEARANCE_KEY,
  INSTALL_DISMISSED_KEY,
  CLEAR_CACHE_KEY,
} from '../device-storage';

/**
 * Every key (or key prefix) the app itself keeps in `localStorage`, as the
 * privacy policy lists them. `device-keys.spec.ts` fails on a key
 * in the app's code that is missing here, so a new one gets its line in
 * the policy too.
 */
export const DEVICE_KEYS = {
  selection: SELECTION_KEY,
  answerPrefix: ANSWER_PREFIX,
  answerIndex: ANSWER_INDEX,
  signedIn: SIGNED_IN_KEY,
  clearCache: CLEAR_CACHE_KEY,
  installDismissed: INSTALL_DISMISSED_KEY,
  appearance: APPEARANCE_KEY,
} as const;
