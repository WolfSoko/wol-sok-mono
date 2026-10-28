import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_TOGGLE_KEYS } from '@wolsok/feat-lazy-bac-game/engine';

/**
 * The feature toggles a `toggles.set` command may set in the rules
 * (`isToggleArgs`) are the game's `FEATURE_TOGGLES`. The spec sits beside
 * the rules, so a change to them alone runs it.
 */
describe('firestore.rules', () => {
  it("lets toggles.set set exactly the game's feature toggles", () => {
    const rules = readFileSync(join(__dirname, '../firestore.rules'), 'utf8');
    const list = rules.slice(rules.indexOf('args.values.keys().hasOnly(['));
    const keys = list
      .slice(0, list.indexOf('])'))
      .match(/'[A-Za-z]+'/g)
      ?.map((key) => key.slice(1, -1));
    expect(keys).toEqual(FEATURE_TOGGLE_KEYS);
  });
});
