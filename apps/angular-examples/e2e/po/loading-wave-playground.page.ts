import { Locator, Page } from '@playwright/test';

/** the loading wave playground: its shader picker and what draws each stage */
export class LoadingWavePlaygroundPage {
  /** "drawn by: …" under the shader stage */
  public readonly gpuRenderer: Locator;
  private readonly shaderPicker: Locator;
  private readonly customFragment: Locator;
  private readonly applyFragment: Locator;

  public constructor(private readonly page: Page) {
    this.gpuRenderer = page.getByTestId('gpu-renderer');
    this.shaderPicker = page.getByTestId('shader');
    this.customFragment = page.getByTestId('custom-fragment');
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
    await this.customFragment.fill(fragment);
    await this.applyFragment.click();
  }
}
