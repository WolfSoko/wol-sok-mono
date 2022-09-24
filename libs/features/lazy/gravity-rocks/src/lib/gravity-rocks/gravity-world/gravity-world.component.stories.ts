import { Meta, moduleMetadata, Story } from '@storybook/angular';
import { GravityWorldComponent } from './gravity-world.component';

export default {
  title: 'GravityWorldComponent',
  component: GravityWorldComponent,
  decorators: [
    moduleMetadata({
      imports: [GravityWorldComponent],
    }),
  ],
} as Meta<GravityWorldComponent>;

const Template: Story<GravityWorldComponent> = (
  args: GravityWorldComponent
) => ({
  props: args,
});

export const Primary = Template.bind({});
Primary.args = {};
