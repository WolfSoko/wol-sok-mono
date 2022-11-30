import { NgModule } from '@angular/core';

import { SharedModule } from '../../../shared/shared.module';
import { MultiPerceptronComponent } from './multi-perceptron/multi-perceptron.component';
import { NeuralNetworkRoutingModule } from './neural-network-routing.module';
import { NeuralNetworkComponent } from './neural-network.component';
import { PerceptronTabComponent } from './perceptron-tab/perceptron-tab.component';
import { BrainSettingsComponent } from './shared/brain-settings/brain-settings.component';
import { DataViewComponent } from './shared/data-view/data-view.component';
import { PerceptronComponent } from './shared/perceptron/perceptron.component';

@NgModule({
  imports: [SharedModule, NeuralNetworkRoutingModule],
  declarations: [
    NeuralNetworkComponent,
    PerceptronComponent,
    DataViewComponent,
    MultiPerceptronComponent,
    PerceptronTabComponent,
    BrainSettingsComponent,
  ],
})
export class NeuralNetworkModule {}
