import { Component, inject } from '@angular/core';
import { Suit } from '../../api/types/suit';
import { Rank } from '../../api/types/rank';
import { CardComponent } from '../../components/card/card.component';
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
  supabaseService = inject(SupabaseService);
  router = inject(Router);
  displayName: string = '';
  /**
   *
   */
  async ngOnInit() {
    const session = await this.supabaseService.loadSession();
    if (session?.user) {
      this.displayName = session.user.user_metadata['display_name'] ?? '';
    }
  }

  async btnCreateGameClick() {
    if (this.supabaseService.session() === null) {
      await this.supabaseService.signInAnon(this.displayName);
    }
    this.router.navigate(['/lobby/create']);
  }

  async btnJoinGameClick() {
    if (this.supabaseService.session() === null) {
      await this.supabaseService.signInAnon(this.displayName);
    }
    this.router.navigate(['/lobby/join']);
  }

  async btnLogoutClick() {
    await this.supabaseService.signOut();
    this.displayName = '';
  }

  get hasSession() {
    return this.supabaseService.session() !== null;
  }

  get currentDisplayName() {
    return this.supabaseService.player().displayName || 'Guest';
  }

  cards = [
    { suit: Suit.Hearts, rank: Rank.Ace, degree: Math.random() * 360 },
    { suit: Suit.Spades, rank: Rank.King, degree: Math.random() * 360 },
    { suit: Suit.Diamonds, rank: Rank.Ten, degree: Math.random() * 360 },
  ];
}
