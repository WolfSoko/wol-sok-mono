import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { GravityWorldComponent } from './gravity-world.component';

export default {
  title: 'GravityWorldComponent',
  component: GravityWorldComponent,
  decorators: [
    moduleMetadata({
      imports: [GravityWorldComponent, BrowserAnimationsModule],
    }),
  ],
} as Meta<GravityWorldComponent>;

type Story = StoryObj<GravityWorldComponent>;

export const Primary: Story = {
  args: {},
};
