import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';

@Component({
  selector: 'app-lobby-room',
  imports: [],
  templateUrl: './lobby-room.component.html',
  styleUrl: './lobby-room.component.scss',
})
export class LobbyRoomComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  supabaseService = inject(SupabaseService);
  copyState = '';

  async ngOnInit() {
    const lobbyId = this.route.snapshot.paramMap.get('id');
    if (lobbyId) {
      this.supabaseService.lobbyId.set(lobbyId);
    }
    const activeLobbyId = this.supabaseService.lobbyId();
    if (activeLobbyId) {
      await this.supabaseService.startLobbyPresence(activeLobbyId);
    }
  }

  async ngOnDestroy() {
    await this.supabaseService.stopLobbyPresence();
  }

  get lobbyId() {
    return this.supabaseService.lobbyId();
  }

  get joinCode() {
    return this.supabaseService.joinCode();
  }

  get players() {
    const list = this.supabaseService.players();
    if (list.length > 0) {
      return list;
    }
    const current = this.supabaseService.player();
    return current?.displayName ? [current] : [];
  }

  get currentPlayerId() {
    return this.supabaseService.player().id;
  }

  get hostId() {
    return this.supabaseService.hostId();
  }

  async copyJoinCode() {
    if (!this.joinCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.joinCode);
      this.copyState = 'Copied';
    } catch {
      this.copyState = 'Copy failed';
    }
    setTimeout(() => {
      this.copyState = '';
    }, 1500);
  }

  async startRound() {
    if (!this.lobbyId) {
      return;
    }
    await this.supabaseService.startRound(this.lobbyId);
    await this.router.navigate(['/play'], { queryParams: { lobbyId: this.lobbyId } });
  }

  async leaveLobby() {
    this.supabaseService.lobbyId.set('');
    this.supabaseService.joinCode.set('');
    this.supabaseService.hostId.set('');
    await this.supabaseService.stopLobbyPresence();
    await this.router.navigate(['/menu']);
  }
}
