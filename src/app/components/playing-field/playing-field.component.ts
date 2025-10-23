import { Component, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-playing-field',
  standalone: true,
  imports: [],
  templateUrl: './playing-field.component.html',
  styleUrl: './playing-field.component.scss',
})
export class PlayingFieldComponent {
  supabaseService = inject(SupabaseService);

  async btnCreateGameClick() {
    // this.supabaseService.getPlayers().then((response) => {
    //   console.log(response);
    // });
    await this.supabaseService.createGame().then((response) => {
      console.log(response, 'Game created');
    });
  }
}
