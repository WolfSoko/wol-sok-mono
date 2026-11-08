import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TeamIdFormComponent } from './team-id-form.component';

async function render(): Promise<{
  readonly form: HTMLElement;
  readonly navigate: ReturnType<typeof vi.spyOn>;
  readonly enter: (text: string) => Promise<void>;
}> {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const navigate = vi
    .spyOn(TestBed.inject(Router), 'navigate')
    .mockResolvedValue(true);
  const fixture = TestBed.createComponent(TeamIdFormComponent);
  await fixture.whenStable();
  const form = fixture.nativeElement as HTMLElement;
  const enter = async (text: string): Promise<void> => {
    const input = form.querySelector('input') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    form.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  return { form, navigate, enter };
}

function fehler(form: HTMLElement): string | undefined {
  return form.querySelector('mat-error')?.textContent?.trim();
}

describe('TeamIdFormComponent', () => {
  it('opens the Team page of the id', async () => {
    const { form, navigate, enter } = await render();

    await enter(' 313036 ');

    expect(navigate).toHaveBeenCalledWith(['/team', 313036]);
    expect(fehler(form)).toBeUndefined();
  });

  it.each(['', '   '])(
    'asks for an id when there is none (%j)',
    async (text) => {
      const { form, navigate, enter } = await render();

      await enter(text);

      expect(navigate).not.toHaveBeenCalled();
      expect(fehler(form)).toBe('Bitte eine Team-ID eingeben.');
    }
  );

  it.each(['abc', '313036abc', '-1', '0', '1.5'])(
    'refuses %s, which is no Team id',
    async (text) => {
      const { form, navigate, enter } = await render();

      await enter(text);

      expect(navigate).not.toHaveBeenCalled();
      expect(fehler(form)).toBe(
        'Eine Team-ID besteht nur aus Ziffern, z. B. 313036.'
      );
    }
  );

  it('shows no error before the first try', async () => {
    const { form } = await render();

    expect(fehler(form)).toBeUndefined();
  });
});
