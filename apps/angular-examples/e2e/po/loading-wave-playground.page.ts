import { Locator, Page } from '@playwright/test';

/** the loading wave playground: its shader picker and what draws each stage */
export class LoadingWavePlaygroundPage {
  /** "drawn by: …" under the shader stage */
  public readonly gpuRenderer: Locator;
  /** the card of buttons and a chip, each with its own wave */
  public readonly smallElements: Locator;
  private readonly shaderPicker: Locator;
  private readonly customFragment: Locator;
  private readonly applyFragment: Locator;

  public constructor(private readonly page: Page) {
    this.gpuRenderer = page.getByTestId('gpu-renderer');
    this.smallElements = page.getByTestId('small-elements');
    this.shaderPicker = page.getByTestId('shader');
    // the code editor (Ace), whose text arrives through its hidden text input
    this.customFragment = page
      .getByTestId('custom-fragment')
      .locator('.ace_editor');
    this.applyFragment = page.getByTestId('apply-fragment');
  }

  public async open(): Promise<void> {
    await this.page.goto('/loadingWavePlayground');
  }

  /** picks a shader for the WebGL stage by its label in the picker */
  public async pickShader(label: string): Promise<void> {
    await this.shaderPicker.click();
    await this.page.getByRole('option', { name: label, exact: true }).click();
  }

  /** picks "Custom" and draws the stage with the given fragment */
  public async applyCustomFragment(fragment: string): Promise<void> {
    await this.pickShader('Custom');
    await this.customFragment.click();
    await this.page.keyboard.press('ControlOrMeta+A');
    await this.page.keyboard.insertText(fragment);
    await this.applyFragment.click();
  }
}
