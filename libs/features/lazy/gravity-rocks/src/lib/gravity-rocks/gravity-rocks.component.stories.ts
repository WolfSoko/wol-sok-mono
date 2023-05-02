import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { Meta, moduleMetadata, StoryFn } from '@storybook/angular';
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

const Template: StoryFn<GravityRocksComponent> = (args: GravityRocksComponent) => ({
  props: args,
});

export const Primary = Template.bind({});
Primary.args = {};
