import {
  FEATURE_TOGGLE_KEYS,
  type FeatureToggle,
  type FeatureToggles,
  featureToggles,
} from '@wolsok/feat-lazy-bac-game/engine';
import type {
  RemoteConfig,
  RemoteConfigTemplate,
} from 'firebase-admin/remote-config';
import type { ModerationChange } from './moderation';

/**
 * The feature toggles (ADR 0012): one Remote Config parameter each, a
 * boolean, set by `toggles.set`. What the command needs of Remote Config
 * is a port, so the specs run without the service.
 */
export interface RemoteToggles {
  /** Every toggle as published, its default where it is not. */
  read(): Promise<FeatureToggles>;
  publish(values: Partial<FeatureToggles>): Promise<void>;
}

/**
 * `toggles.set`: publishes the values, audited with what each toggle was
 * and is now.
 */
export async function setToggles(
  remote: RemoteToggles,
  values: Partial<FeatureToggles>
): Promise<ModerationChange> {
  const now = await remote.read();
  await remote.publish(values);
  const changed = Object.keys(values) as FeatureToggle[];
  return {
    before: Object.fromEntries(changed.map((key) => [key, now[key]])),
    after: values,
  };
}

/** The toggles a template holds, by their default value. */
export function togglesOf(template: RemoteConfigTemplate): FeatureToggles {
  return featureToggles((key) => {
    const value = template.parameters[key]?.defaultValue;
    return value !== undefined && 'value' in value
      ? value.value === 'true'
      : undefined;
  });
}

/**
 * Sets the toggles' parameters in a template: a boolean default value,
 * and no conditional values, so every client gets what the admin area
 * shows.
 */
export function withToggles(
  template: RemoteConfigTemplate,
  values: Partial<FeatureToggles>
): RemoteConfigTemplate {
  for (const key of FEATURE_TOGGLE_KEYS) {
    const value = values[key];
    if (value !== undefined) {
      template.parameters[key] = {
        defaultValue: { value: String(value) },
        valueType: 'BOOLEAN',
        description: `Bacteria Wars feature toggle (ADR 0012), set from the admin area.`,
      };
    }
  }
  return template;
}

/**
 * The port on the project's Remote Config, opened on first use. Publishing
 * sends the template's ETag along: a template changed meanwhile fails the
 * command, and the owner sends it again.
 */
export function remoteTogglesOf(
  remoteConfig: () => Promise<RemoteConfig>
): RemoteToggles {
  return {
    read: async () => togglesOf(await (await remoteConfig()).getTemplate()),
    publish: async (values) => {
      const config = await remoteConfig();
      await config.publishTemplate(
        withToggles(await config.getTemplate(), values)
      );
    },
  };
}
