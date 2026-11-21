import { LabPassFacts, labPassSteps, nextStep } from './lab-pass';

const NOTHING: LabPassFacts = {
  signedIn: false,
  profileSaved: false,
  motto: false,
  friend: false,
};

describe('the Lab Pass', () => {
  it('starts with every step open, signing in first', () => {
    const steps = labPassSteps(NOTHING);

    expect(steps.map(({ id }) => id)).toEqual([
      'sign-in',
      'profile',
      'motto',
      'friend',
    ]);
    expect(steps.every(({ done }) => !done)).toBe(true);
    expect(nextStep(steps)).toBe('sign-in');
  });

  it('marks each step done by its own fact', () => {
    const steps = labPassSteps({ ...NOTHING, signedIn: true, motto: true });

    expect(steps.filter(({ done }) => done).map(({ id }) => id)).toEqual([
      'sign-in',
      'motto',
    ]);
    expect(nextStep(steps)).toBe('profile');
  });

  it('has no next step once all are done', () => {
    expect(
      nextStep(
        labPassSteps({
          signedIn: true,
          profileSaved: true,
          motto: true,
          friend: true,
        })
      )
    ).toBeNull();
  });
});
