import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ElevateCardModule } from '@wolsok/ui-kit';
import { ReactionDiffRoutingModule } from './reaction-diff-routing.module';
import { P5ViewComponent } from './reaction-diff/p5-view/p5-view.component';
import { ReactionDiffComponent } from './reaction-diff/reaction-diff.component';
import { WeightsConfigComponent } from './reaction-diff/weights-config/weights-config.component';

@NgModule({
  imports: [
    ReactionDiffRoutingModule,
    CommonModule,
    ElevateCardModule,
    FormsModule,
    MatCheckboxModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatCardModule,
    MatSelectModule,
    MatInputModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatTooltipModule,
  ],
  declarations: [
    ReactionDiffComponent,
    P5ViewComponent,
    WeightsConfigComponent,
  ],
})
export class ReactionDiffModule {}
