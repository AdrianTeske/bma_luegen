import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-lobby-create',
  imports: [FormsModule, RouterModule],
  templateUrl: './lobby-create.component.html',
  styleUrl: './lobby-create.component.scss',
})
export class LobbyCreateComponent {
  supabaseService = inject(SupabaseService);
  decks = 1;

  get totalCards() {
    const normalizedDecks = Math.max(1, Math.floor(Number(this.decks) || 1));
    return normalizedDecks * 52;
  }

  async createLobbyClick() {
    const normalizedDecks = Math.max(1, Math.floor(Number(this.decks) || 1));
    this.decks = normalizedDecks;
    await this.supabaseService.createLobby(normalizedDecks);
  }
}
