import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutes } from './app.routing';
import { AppComponent } from './app.component';
import { SelAngBrushComponent } from './sel-ang-brush/sel-ang-brush.component';
import { PageNotFoundComponent } from './pagenotfound/pagenotfound.component';
import { ReferenceComponent } from './reference/reference.component';
import { AboutComponent } from './about/about.component';

@NgModule({
  imports: [
    BrowserModule,
    AppRoutes
  ],
  declarations: [
    AppComponent,
    SelAngBrushComponent,
    PageNotFoundComponent,
    ReferenceComponent,
    AboutComponent
  ],
  bootstrap: [
    AppComponent
  ]
})
export class AppModule { }
