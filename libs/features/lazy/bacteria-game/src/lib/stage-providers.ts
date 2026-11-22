import { Provider } from '@angular/core';
import { MatchEnd } from './flow/match-end';
import { MatchSetup } from './flow/match-setup';
import { OnlineFlow } from './flow/online-flow';
import { PlayFlow } from './flow/play-flow';
import { HudState } from './hud/hud-state';
import { PlayGamesHandover } from './play-games/play-games-handover';
import { ArenaStage } from './stage/arena-stage';
import { StageFrame } from './stage/stage-frame';
import { StageFullscreen } from './stage/stage-fullscreen';
import { StageInput } from './stage/stage-input';

/**
 * The parts of one stage, one of each per stage component: its view of the
 * arena (`stage/`), what the HUD shows (`hud/`), its way through the
 * game (`flow/`) and the Android app's Play Games sign-in (`play-games/`).
 */
export const STAGE_PROVIDERS: Provider[] = [
  StageFullscreen,
  ArenaStage,
  StageFrame,
  StageInput,
  HudState,
  PlayFlow,
  MatchSetup,
  OnlineFlow,
  PlayGamesHandover,
  MatchEnd,
];
