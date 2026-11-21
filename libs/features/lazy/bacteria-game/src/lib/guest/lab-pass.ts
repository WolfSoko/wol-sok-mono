/**
 * The Lab Pass: the steps that make a guest a member of the lab - signing
 * in, a profile of their own, a motto, a first friend. Each step follows
 * from what the game knows already; nothing about the pass is stored but
 * the achievement it earns.
 */

/** The pass's steps, in the order the player takes them. */
export const LAB_PASS_STEPS = [
  'sign-in',
  'profile',
  'motto',
  'friend',
] as const;

export type LabPassStepId = (typeof LAB_PASS_STEPS)[number];

/** What the game knows that decides the steps. */
export interface LabPassFacts {
  /** The player signed in: no guest. */
  signedIn: boolean;
  /** The player saved a profile of their own. */
  profileSaved: boolean;
  /** The saved profile has a motto. */
  motto: boolean;
  /** The player has a friend. */
  friend: boolean;
}

export interface LabPassStep {
  id: LabPassStepId;
  done: boolean;
}

const FACT_OF: Readonly<Record<LabPassStepId, keyof LabPassFacts>> = {
  'sign-in': 'signedIn',
  profile: 'profileSaved',
  motto: 'motto',
  friend: 'friend',
};

/** The pass's steps, each done when its fact holds. */
export function labPassSteps(facts: LabPassFacts): readonly LabPassStep[] {
  return LAB_PASS_STEPS.map((id) => ({ id, done: facts[FACT_OF[id]] }));
}

/** The first step still open, null once all are done. */
export function nextStep(steps: readonly LabPassStep[]): LabPassStepId | null {
  return steps.find(({ done }) => !done)?.id ?? null;
}
