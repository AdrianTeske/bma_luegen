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

  btnCreateGameClick() {
    this.supabaseService.getPlayers().then((response) => {
      console.log(response);
    });
  }
}
