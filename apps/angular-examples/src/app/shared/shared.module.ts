import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  ElemResizedModule,
  ElevateCardModule,
  RenderShaderComponent,
} from '@wolsok/ui-kit';
import { WsThanosModule } from '@wolsok/ws-thanos';
import { Angulartics2Module } from 'angulartics2';

@NgModule({
  imports: [CommonModule, ElevateCardModule, RenderShaderComponent],
  exports: [
    RenderShaderComponent,
    ElevateCardModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatInputModule,
    MatToolbarModule,
    MatTooltipModule,
    MatIconModule,
    MatCardModule,
    MatDialogModule,
    MatListModule,
    MatSelectModule,
    MatSidenavModule,
    MatGridListModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatSliderModule,
    MatChipsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    Angulartics2Module,
    WsThanosModule,
    ElemResizedModule,
  ],
})
export class SharedModule {}
