import {
  type FeatureToggle,
  type FeatureToggleStates,
  featureToggles,
  parseToggleText,
  toggleText,
} from '@wolsok/feat-shared-bacteria-engine/cloud';
import type {
  RemoteConfig,
  RemoteConfigParameter,
  RemoteConfigTemplate,
} from 'firebase-admin/remote-config';
import type { ModerationChange } from './moderation';

/**
 * The feature toggles (ADR 0012): one Remote Config parameter each, its
 * state as `toggleText` writes it, set by `toggles.set`. What the command needs of Remote Config
 * is a port, so the specs run without the service.
 */
export interface RemoteToggles {
  /**
   * Reads the toggles once, publishes what `decide` makes of them -
   * nothing when it returns no toggle - and returns them as read.
   */
  update(
    decide: (now: FeatureToggleStates) => Partial<FeatureToggleStates>
  ): Promise<FeatureToggleStates>;
}

/**
 * `toggles.set`: publishes the toggles that change, audited with what they
 * were and are now; `unchanged` when every value is set already.
 */
export async function setToggles(
  remote: RemoteToggles,
  values: Partial<FeatureToggleStates>
): Promise<ModerationChange | 'unchanged'> {
  let after: Partial<FeatureToggleStates> = {};
  const now = await remote.update((current) => {
    after = Object.fromEntries(
      Object.entries(values).filter(
        ([key, state]) => current[key as FeatureToggle] !== state
      )
    );
    return after;
  });
  const changed = Object.keys(after) as FeatureToggle[];
  if (changed.length === 0) {
    return 'unchanged';
  }
  return {
    before: Object.fromEntries(changed.map((key) => [key, now[key]])),
    after,
  };
}

/** The parameters a toggle sits among: the top level, or its group's. */
function holderOf(
  template: RemoteConfigTemplate,
  key: string
): Record<string, RemoteConfigParameter> {
  for (const group of Object.values(template.parameterGroups ?? {})) {
    if (key in group.parameters) {
      return group.parameters;
    }
  }
  return template.parameters;
}

/** The toggles' states a template holds, by their default value. */
export function togglesOf(template: RemoteConfigTemplate): FeatureToggleStates {
  return featureToggles((key) => {
    const value = holderOf(template, key)[key]?.defaultValue;
    return value === undefined || !('value' in value)
      ? undefined
      : parseToggleText(value.value);
  });
}

/**
 * A copy of the template with the toggles' parameters set, where they sit
 * (in their group, if any): the state's text as the default value - a
 * STRING, since `admin` is no boolean - and no conditional values, so
 * every client gets what the admin area shows.
 */
export function withToggles(
  template: RemoteConfigTemplate,
  values: Partial<FeatureToggleStates>
): RemoteConfigTemplate {
  const copy = structuredClone(template);
  for (const [key, state] of Object.entries(values)) {
    holderOf(copy, key)[key] = {
      defaultValue: { value: toggleText(state) },
      valueType: 'STRING',
      description:
        'Bacteria Wars feature toggle (ADR 0012), set from the admin area.',
    };
  }
  return copy;
}

/**
 * The port on the project's Remote Config, opened on first use. It reads
 * the template once and publishes with its ETag: a template changed
 * meanwhile fails the command, and the owner sends it again.
 */
export function remoteTogglesOf(
  remoteConfig: () => Promise<RemoteConfig>
): RemoteToggles {
  return {
    update: async (decide) => {
      const config = await remoteConfig();
      const template = await config.getTemplate();
      const now = togglesOf(template);
      const values = decide(now);
      if (Object.keys(values).length > 0) {
        await config.publishTemplate(withToggles(template, values));
      }
      return now;
    },
  };
}
