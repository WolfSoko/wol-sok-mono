import { GpuSimulation } from '../gl/gpu-simulation';
import { BacteriaSimulation } from '../state/bacteria-simulation';
import { Simulation } from '../state/simulation';
import { ColonyLayer } from './colony-renderer';

/**
 * The colonies of a simulation as the painter draws them: the bacteria of
 * the CPU one, or where each colony sits in the GPU one's state texture.
 * `boosted` holds the players whose boost is running.
 */
export function colonyLayers(
  simulation: Simulation,
  boosted: ReadonlySet<number>
): ColonyLayer[] {
  if (simulation instanceof GpuSimulation) {
    const state = simulation.stateTexture();
    if (state == null) {
      return [];
    }
    return simulation.summaries().map((summary, slot) => ({
      color: summary.color,
      bacterias: [],
      boosted: boosted.has(summary.playerId),
      gpu: { state, owner: slot + 1, bounds: simulation.boundsOf(slot) },
    }));
  }
  if (simulation instanceof BacteriaSimulation) {
    return simulation.getColonies().map((colony) => ({
      color: colony.color,
      bacterias: colony.bacterias,
      boosted: boosted.has(colony.playerId),
    }));
  }
  return [];
}
