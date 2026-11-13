import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonToggleGroupHarness } from '@angular/material/button-toggle/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { ThemeService } from '@wolsok/shared-theme';
import { APPEARANCE_KEY } from '../device-storage';
import { provideAppearance } from './appearance';
import { AppearanceChoiceComponent } from './appearance-choice.component';

async function openPage(): Promise<MatButtonToggleGroupHarness> {
  TestBed.configureTestingModule({
    providers: [
      provideAppearance(),
      { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
    ],
  });
  const fixture = TestBed.createComponent(AppearanceChoiceComponent);
  return TestbedHarnessEnvironment.loader(fixture).getHarness(
    MatButtonToggleGroupHarness.with({ selector: '[aria-label="Darstellung"]' })
  );
}

async function chosen(group: MatButtonToggleGroupHarness): Promise<string[]> {
  const selected: string[] = [];
  for (const option of await group.getToggles()) {
    if (await option.isChecked()) {
      selected.push(await option.getText());
    }
  }
  return selected;
}

describe('AppearanceChoiceComponent', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('offers System, Hell and Dunkel in German, System by default', async () => {
    const group = await openPage();

    const names = await Promise.all(
      (await group.getToggles()).map((option) => option.getText())
    );
    expect(names).toEqual(['System', 'Hell', 'Dunkel']);
    expect(await chosen(group)).toEqual(['System']);
  });

  it('applies and keeps the look chosen', async () => {
    const group = await openPage();

    await (await group.getToggles({ text: 'Dunkel' }))[0].check();

    expect(TestBed.inject(ThemeService).choice()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(APPEARANCE_KEY)).toBe('dark');
    expect(await chosen(group)).toEqual(['Dunkel']);

    await (await group.getToggles({ text: 'System' }))[0].check();

    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(APPEARANCE_KEY)).toBeNull();
  });

  it('shows the look kept on the device', async () => {
    localStorage.setItem(APPEARANCE_KEY, 'light');

    expect(await chosen(await openPage())).toEqual(['Hell']);
  });
});
