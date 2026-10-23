export * from './lib/routes';
export {
  LEGAL_NOTICE_URL,
  PRIVACY_POLICY_URL,
} from './lib/support/legal-links';
export { provideGameCloud } from './lib/storage/provide-game-cloud';
export type { GameCloudOptions } from './lib/storage/game-cloud';
export { provideGameSupport } from './lib/support/provide-game-support';
export type {
  GameAdsOptions,
  GameSupportOptions,
} from './lib/support/game-support';
export { I18nService } from './lib/i18n/i18n.service';
