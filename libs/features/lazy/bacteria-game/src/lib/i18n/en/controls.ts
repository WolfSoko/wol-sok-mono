/**
 * The touch controls of a match - the joystick zone and the boost pad - and
 * the colour picker of the two seats.
 */
export const controls = {
  joystick: 'Joystick {name}',
  boost: {
    ready: 'Boost',
    boosting: 'Boosting',
    cooldown: '{seconds}s',
    button: 'Boost {name}',
    recharge: 'Boost recharge',
  },
  /*
   * The keys that fire a weapon. Only a match against the computer arms
   * anyone, so they fire the one weapon at the screen:
   * "In a match against the computer, E or the right Shift fires your weapon."
   */
  weaponKeys: {
    before: 'In a match against the computer,',
    e: 'E',
    or: 'or the',
    shift: 'right Shift',
    after: 'fires your weapon.',
  },
  colors: {
    left: 'Left player',
    right: 'Right player',
    group: 'Colour of {seat}',
    locked: '{color}, locked: {lock}',
    lockedTip: '{color} - {lock}',
    toEarn: 'Colours still to earn',
  },
};
