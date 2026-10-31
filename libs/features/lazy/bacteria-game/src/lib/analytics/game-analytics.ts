import { AppAnalytics, injectAnalytics } from '@wolsok/shared-analytics';
import type { AchievementId } from '../state/achievement-ids';
import type { EndReason } from '../state/win-conditions';

/** How a match is played, as the statistics tell the modes apart. */
export type MatchKind =
  | 'vs_computer'
  | 'training'
  | 'daily'
  | 'endless'
  | 'two_players'
  | 'online'
  | 'ghost';

/** What every event about a match says of it. */
export type MatchParams = {
  /** The level's id, never a name a player gave. */
  level_name: string;
  kind: MatchKind;
  /** The computer's difficulty, `none` without one. */
  difficulty: string;
  ranked: boolean;
  /** What plays the war: `cpu`, `gpu` or `int` (the integer CPU twin). */
  simulation: string;
  /** The ruleset: `cpu`, `gpu-int` or `float` (the float GPU, unrecorded). */
  ruleset: string;
};

/** For the people at this device: `decided` between two of them. */
export type MatchOutcomeName = 'win' | 'loss' | 'draw' | 'decided';

/**
 * What the game measures, with what each event carries (docs/analytics.md).
 * GA4's recommended game events where one fits (`level_start`,
 * `level_end`, `unlock_achievement`, `level_up`, `spend_virtual_currency`,
 * `login`, `share`). Never a player's name, id, motto or friend, nor a
 * replay's or a room's id.
 */
export type GameEvents = {
  level_start: MatchParams;
  level_end: MatchParams & {
    success: boolean;
    outcome: MatchOutcomeName;
    reason: EndReason;
    duration_sec: number;
    /** The medallion it earned, `none` for none. */
    medal: string;
    new_best: boolean;
    achievements: number;
    levels_unlocked: number;
    xp: number;
    /** On a training mission's level: whether it did the mission. */
    mission_done?: boolean;
  };
  /** Left, restarted or given up before it ended. */
  match_abandoned: MatchParams & { duration_sec: number };
  unlock_achievement: { achievement_id: AchievementId };
  /** A new rank: `level` its number from 1, `character` its id. */
  level_up: { level: number; character: string };
  spend_virtual_currency: {
    virtual_currency_name: 'dna';
    value: number;
    item_name: string;
    item_category: 'gene' | 'weapon' | 'skin';
  };
  /** A device setting the player changed, with its new value. */
  setting_changed: { setting: string; value: string | number | boolean };
  profile_saved: { first: boolean };
  friend_request_sent: Record<string, never>;
  friend_request_answered: { accepted: boolean };
  friend_removed: Record<string, never>;
  /** Someone took a friend's invite link. */
  invite_accepted: Record<string, never>;
  challenge_sent: Record<string, never>;
  matchmaking_started: Record<string, never>;
  matchmaking_found: { wait_sec: number };
  /** `found`: the player gave up a match already found. */
  matchmaking_cancelled: { found: boolean; wait_sec: number };
  /** The two devices of an online match are linked. */
  online_connected: { role: string; matchmade: boolean };
  /**
   * The online link ended with a notice to the player: `reason` how (`lost`,
   * `left`), `notice` the text's key, which says why.
   */
  online_ended: { reason: string; notice: string };
  /** A recorded match the cloud (or this device) took. */
  replay_saved: { online: boolean; ranked: boolean };
  replay_watched: { source: 'my_matches' };
  replay_deleted: { cloud: boolean };
  /** "Keep out of the gallery": the match stays in My matches. */
  replay_kept_out: { cloud: boolean };
  /** The Play tips (in the Android app; the web links to Buy Me a Coffee). */
  tip_dialog_opened: Record<string, never>;
  /** `outcome`: `purchased`, `cancelled` or `failed`. */
  tip: { product_id: string; outcome: string };
  /** The browser's install prompt: `accepted` or `dismissed`. */
  install_prompt: { outcome: string };
  install_offer_dismissed: Record<string, never>;
  app_installed: Record<string, never>;
  tip_link_opened: Record<string, never>;
  /** The GPU self-test ran here (once per GPU and version of the test). */
  gpu_self_test: { passed: boolean; ran_through: boolean };
  /** The GPU simulation failed to start: matches play on the CPU. */
  simulation_fallback: Record<string, never>;
  /** A friend's invite link or a run as a ghost to beat, passed on. */
  share: {
    method: 'native' | 'copy';
    content_type: 'friend_invite' | 'ghost_run';
  };
  login: { method: 'google' };
  login_failed: { reason: 'cancelled' | 'failed' };
  logout: Record<string, never>;
};

/**
 * The game's analytics. Only the game's own site provides it (the remote's
 * app config, with the player's consent): inside the shell, in development
 * and in specs every call does nothing.
 */
export function injectGameAnalytics(): AppAnalytics<GameEvents> {
  return injectAnalytics<GameEvents>();
}
