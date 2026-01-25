import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
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
  private gameChannel?: RealtimeChannel;
  gameStatus = 'standby';

  async ngOnInit() {
    const lobbyId = this.route.snapshot.paramMap.get('id');
    if (lobbyId) {
      this.supabaseService.lobbyId.set(lobbyId);
    }
    const storedLobbyId = localStorage.getItem('lobbyId') ?? '';
    const storedJoinCode = localStorage.getItem('lobbyJoinCode') ?? '';
    if (!this.supabaseService.lobbyId() && storedLobbyId) {
      this.supabaseService.lobbyId.set(storedLobbyId);
    }
    if (!this.supabaseService.joinCode() && storedJoinCode) {
      this.supabaseService.joinCode.set(storedJoinCode);
    }
    const activeLobbyId = this.supabaseService.lobbyId();
    if (activeLobbyId) {
      await this.supabaseService.joinLobby(activeLobbyId);
      await this.supabaseService.startLobbyPresence(activeLobbyId);
      await this.loadGame(activeLobbyId);
      await this.subscribeGame(activeLobbyId);
    }
  }

  async ngOnDestroy() {
    await this.supabaseService.stopLobbyPresence();
    if (this.gameChannel) {
      this.supabaseService.getClient().removeChannel(this.gameChannel);
    }
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

  get isHost() {
    return !!this.hostId && this.hostId === this.currentPlayerId;
  }

  private async loadGame(lobbyId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('game')
      .select('id, host, status')
      .eq('id', lobbyId)
      .single();

    if (!error && data) {
      this.supabaseService.hostId.set(data.host ?? '');
      this.gameStatus = data.status ?? 'standby';
      if (this.gameStatus !== 'standby') {
        await this.router.navigate(['/play'], {
          queryParams: { lobbyId },
        });
      }
    }
  }

  private async subscribeGame(lobbyId: string) {
    const client = this.supabaseService.getClient();
    this.gameChannel = client
      .channel(`game:${lobbyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game', filter: `id=eq.${lobbyId}` },
        async (payload) => {
          const next = payload.new as { host?: string | null; status?: string | null };
          if (next?.host !== undefined) {
            this.supabaseService.hostId.set(next.host ?? '');
          }
          if (next?.status) {
            this.gameStatus = next.status;
          }
          if (this.gameStatus !== 'standby') {
            await this.router.navigate(['/play'], {
              queryParams: { lobbyId },
            });
          }
        }
      )
      .subscribe();
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
    if (!this.isHost) {
      return;
    }
    await this.supabaseService.startRound(this.lobbyId);
  }

  async leaveLobby() {
    this.supabaseService.lobbyId.set('');
    this.supabaseService.joinCode.set('');
    this.supabaseService.hostId.set('');
    await this.supabaseService.stopLobbyPresence();
    if (this.gameChannel) {
      this.supabaseService.getClient().removeChannel(this.gameChannel);
      this.gameChannel = undefined;
    }
    await this.router.navigate(['/menu']);
  }
}
