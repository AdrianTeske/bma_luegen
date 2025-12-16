import { Component, inject, input } from '@angular/core';
import { Suit } from '../../api/types/suit';
import { Rank } from '../../api/types/rank';
import { PlayerHandComponent } from "../player-hand/player-hand.component";
import { CardComponent } from "../card/card.component";
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-menu',
  imports: [CardComponent, FormsModule],
  templateUrl: './menu.component.html',
  styleUrl: './menu.component.scss',
})
export class MenuComponent {
  router = inject(Router);
  supabaseService = inject(SupabaseService);
  displayName: string = '';
  /**
   *
   */
  constructor() {
    this.supabaseService.getUser().then(({ data: { user } }: any) => {
      if (user) {
        this.displayName = user.user_metadata?.display_name;
        this.router.navigate(['/play']);
      }
  });
  }

  cards = [
    { suit: Suit.Hearts, rank: Rank.Ace, degree: Math.random() * 360 },
    { suit: Suit.Spades, rank: Rank.King, degree: Math.random() * 360 },
    { suit: Suit.Diamonds, rank: Rank.Ten, degree: Math.random() * 360 },
  ];
}
