import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { GravityRocksComponent } from './gravity-rocks.component';

export default {
  title: 'GravityRocksComponent',
  component: GravityRocksComponent,
  decorators: [
    moduleMetadata({
      imports: [GravityRocksComponent, BrowserAnimationsModule],
    }),
  ],
} as Meta<GravityRocksComponent>;

type Story = StoryObj<GravityRocksComponent>;

export const Primary: Story = {
  args: {},
};
