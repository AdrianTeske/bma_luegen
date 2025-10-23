import { Component, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../services/supabase.service';
import { PlayerHandComponent } from "../player-hand/player-hand.component";
import { Suit } from '../../api/types/suit';
import { Rank } from '../../api/types/rank';

@Component({
  selector: 'app-playing-field',
  standalone: true,
  imports: [PlayerHandComponent],
  templateUrl: './playing-field.component.html',
  styleUrl: './playing-field.component.scss',
})
export class PlayingFieldComponent {
  supabaseService = inject(SupabaseService);

  cards = [
    { suit: Suit.Hearts, rank: Rank.Ace },
    { suit: Suit.Spades, rank: Rank.King },
    { suit: Suit.Diamonds, rank: Rank.Ten },
  ];

  async btnCreateGameClick() {
    // this.supabaseService.getPlayers().then((response) => {
    //   console.log(response);
    // });
    await this.supabaseService.createGame().then((response) => {
      console.log(response, 'Game created');
    });
  }
}
