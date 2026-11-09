import type { Locator, Page } from '@playwright/test';

/**
 * The follow control of the Team `name` in a list (a Verein's Teams, an
 * overview card, the wizard), whose label names the Team: "Team folgen:
 * name" while it is not followed, "Nicht mehr folgen: name" while it is.
 */
export function folgenKnopf(
  bereich: Page | Locator,
  name: string,
  { gefolgt }: { gefolgt: boolean }
): Locator {
  const aktion = gefolgt ? 'Nicht mehr folgen' : 'Team folgen';
  return bereich.getByRole('button', {
    name: `${aktion}: ${name}`,
    exact: true,
  });
}
