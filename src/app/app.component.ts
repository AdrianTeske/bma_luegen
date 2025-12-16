import { Component } from '@angular/core';
import { PlayingFieldComponent } from './components/playing-field/playing-field.component';
import { RouterOutlet } from "@angular/router";

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    standalone: true,
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'bma_luegen';
}
