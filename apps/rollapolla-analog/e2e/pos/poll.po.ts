import { expect, Locator, Page } from '@playwright/test';

export class PollPo {
  constructor(private readonly page: Page) {}

  async createPoll(question: string, options: string[]): Promise<void> {
    const questionInput = this.page.getByTestId('poll-question-input');
    await questionInput.scrollIntoViewIfNeeded();
    // The form hydrates once it is in the viewport; typing earlier is lost.
    await expect(async () => {
      await questionInput.fill(question);
      await expect(
        this.page.getByText(`${question.length}/`, { exact: false })
      ).toBeVisible({ timeout: 1000 });
    }).toPass();
    for (let i = 0; i < options.length; i++) {
      if (i >= 2) {
        await this.page.getByTestId('add-option-button').click();
      }
      await this.page.getByTestId(`poll-option-input-${i}`).fill(options[i]);
    }
    await this.page.getByTestId('create-poll-button').click();
  }

  async expectPollPage(question: string): Promise<void> {
    await expect(this.page).toHaveURL(/\/poll\/[\w-]+$/);
    await expect(this.page.getByTestId('poll-question')).toHaveText(question);
  }

  async vote(optionIndex: number): Promise<void> {
    await this.page.getByTestId(`poll-option-${optionIndex}`).click();
    await this.page.getByTestId('vote-button').click();
  }

  result(optionIndex: number): Locator {
    return this.page.getByTestId(`poll-result-${optionIndex}`);
  }
}
