import { Locator, Page } from '@playwright/test';

export class AngularExamplesPage {
  experimentsTitle: Locator;
  constructor(private readonly page: Page) {
    this.experimentsTitle = page.locator('mat-card-title');
  }
}
