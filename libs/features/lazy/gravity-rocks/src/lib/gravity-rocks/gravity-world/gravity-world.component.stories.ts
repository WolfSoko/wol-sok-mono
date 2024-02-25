import {
  BrowserAnimationsModule,
  provideAnimations,
} from '@angular/platform-browser/animations';
import { Meta, moduleMetadata, StoryFn } from '@storybook/angular';
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

const Template: StoryFn<GravityWorldComponent> = (
  args: GravityWorldComponent
) => ({
  props: args,
});

export const Primary = Template.bind({});
Primary.args = {};
