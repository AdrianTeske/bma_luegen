import { Component } from '@angular/core';
import { PlayingFieldComponent } from './components/playing-field/playing-field.component';

@Component({
    selector: 'app-root',
    imports: [PlayingFieldComponent],
    standalone: true,
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'bma_luegen';
}
