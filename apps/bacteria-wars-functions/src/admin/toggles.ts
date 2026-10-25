import {
  FEATURE_TOGGLE_KEYS,
  type FeatureToggle,
  type FeatureToggles,
  featureToggles,
} from '@wolsok/feat-lazy-bac-game/engine';
import type {
  RemoteConfig,
  RemoteConfigParameter,
  RemoteConfigTemplate,
} from 'firebase-admin/remote-config';
import type { ModerationChange } from './moderation';

/**
 * The feature toggles (ADR 0012): one Remote Config parameter each, a
 * boolean, set by `toggles.set`. What the command needs of Remote Config
 * is a port, so the specs run without the service.
 */
export interface RemoteToggles {
  /**
   * Publishes the values that differ from the template, read once, and
   * returns what those toggles were - empty when none differed and nothing
   * was published.
   */
  update(values: Partial<FeatureToggles>): Promise<Partial<FeatureToggles>>;
}

/**
 * `toggles.set`: publishes the toggles that change, audited with what they
 * were and are now; `unchanged` when every value is set already.
 */
export async function setToggles(
  remote: RemoteToggles,
  values: Partial<FeatureToggles>
): Promise<ModerationChange | 'unchanged'> {
  const before = await remote.update(values);
  const changed = Object.keys(before) as FeatureToggle[];
  if (changed.length === 0) {
    return 'unchanged';
  }
  return {
    before,
    after: Object.fromEntries(changed.map((key) => [key, values[key]])),
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

/** The toggles a template holds, by their default value. */
export function togglesOf(template: RemoteConfigTemplate): FeatureToggles {
  return featureToggles((key) => {
    const value = holderOf(template, key)[key]?.defaultValue;
    if (value === undefined || !('value' in value)) {
      return undefined;
    }
    const text = value.value.trim().toLowerCase();
    return text === 'true' ? true : text === 'false' ? false : undefined;
  });
}

/**
 * A copy of the template with the toggles' parameters set, where they sit
 * (in their group, if any): a boolean default value and no conditional
 * values, so every client gets what the admin area shows.
 */
export function withToggles(
  template: RemoteConfigTemplate,
  values: Partial<FeatureToggles>
): RemoteConfigTemplate {
  const copy = structuredClone(template);
  for (const key of FEATURE_TOGGLE_KEYS) {
    const value = values[key];
    if (value !== undefined) {
      holderOf(copy, key)[key] = {
        defaultValue: { value: String(value) },
        valueType: 'BOOLEAN',
        description:
          'Bacteria Wars feature toggle (ADR 0012), set from the admin area.',
      };
    }
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
    update: async (values) => {
      const config = await remoteConfig();
      const template = await config.getTemplate();
      const now = togglesOf(template);
      const before = Object.fromEntries(
        FEATURE_TOGGLE_KEYS.filter(
          (key) => values[key] !== undefined && values[key] !== now[key]
        ).map((key) => [key, now[key]])
      ) as Partial<FeatureToggles>;
      const changed = Object.keys(before) as FeatureToggle[];
      if (changed.length > 0) {
        await config.publishTemplate(
          withToggles(
            template,
            Object.fromEntries(changed.map((key) => [key, values[key]]))
          )
        );
      }
      return before;
    },
  };
}
