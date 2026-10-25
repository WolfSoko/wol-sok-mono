export * from './lib/routes';
export {
  ADMIN_PATH,
  GAME_SITE_URL,
  LEGAL_NOTICE_PATH,
  PRIVACY_POLICY_PATH,
  PRIVACY_POLICY_URL,
} from './lib/support/legal-links';
export { SPLASH_ID } from './lib/splash';
export {
  GALLERY_PATH,
  WATCH_PARAM,
  WATCH_PATH,
} from './lib/replays/watch-links';
export { provideGameCloud } from './lib/storage/provide-game-cloud';
export type { GameCloudOptions } from './lib/storage/game-cloud';
export { provideGameSupport } from './lib/support/provide-game-support';
export type {
  GameAdsOptions,
  GameSupportOptions,
} from './lib/support/game-support';
export { I18nService } from './lib/i18n/i18n.service';
