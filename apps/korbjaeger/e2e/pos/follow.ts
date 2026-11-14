import type { Locator, Page } from '@playwright/test';

/**
 * The follow control of the Team `name` in a list (a Verein's Teams, an
 * overview card, the wizard), whose label names the Team: "Team folgen:
 * name" while it is not followed, "Nicht mehr folgen: name" while it is.
 */
export function followButton(
  scope: Page | Locator,
  name: string,
  { followed }: { followed: boolean }
): Locator {
  const action = followed ? 'Nicht mehr folgen' : 'Team folgen';
  return scope.getByRole('button', {
    name: `${action}: ${name}`,
    exact: true,
  });
}
