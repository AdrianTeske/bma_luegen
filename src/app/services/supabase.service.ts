import { inject, Injectable, signal } from '@angular/core';
import {
  createClient,
  RealtimeChannel,
  Session,
  SupabaseClient,
} from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { Player } from '../api/entities/player';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase!: SupabaseClient;
  private lobbyPresenceChannel?: RealtimeChannel;
  player = signal<Player>(new Player('', ''));
  players = signal<Player[]>([]);
  lobbyId = signal<string>('');
  joinCode = signal<string>('');
  hostId = signal<string>('');
  session = signal<Session | null>(null);
  router = inject(Router);

  constructor() {
    const supabaseUrl = environment.supabaseUrl;
    const supabaseKey = environment.supabaseAnonKey;

    try {
      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: true,
            detectSessionInUrl: false,
          },
        });
      }
    } catch (error) {
      console.error(error);
    }
  }

  async fetchUser() {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    if (user) {
      this.player.set(
        new Player(user.id, user.user_metadata?.['display_name'])
      );
    }
    return user;
  }

  async loadSession() {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    this.session.set(session ?? null);
    if (session?.user) {
      this.player.set(
        new Player(session.user.id, session.user.user_metadata?.['display_name'])
      );
    }
    return session;
  }

  async signInAnon(displayName?: string) {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();
    if (session?.user) {
      let activeSession = session;
      const currentName =
        session.user.user_metadata?.['display_name']?.toString() ?? '';
      if (displayName && displayName !== currentName) {
        const { data, error } = await this.supabase.auth.updateUser({
          data: { display_name: displayName },
        });
        if (error) {
          console.error(error);
        } else if (data?.user) {
          this.player.set(
            new Player(
              data.user.id,
              data.user.user_metadata?.['display_name']
            )
          );
          const {
            data: { session: refreshedSession },
          } = await this.supabase.auth.getSession();
          activeSession = refreshedSession ?? activeSession;
        }
        await this.fetchUser();
      }
      this.session.set(activeSession);
      if (!this.player().id && activeSession?.user) {
        this.player.set(
          new Player(
            activeSession.user.id,
            activeSession.user.user_metadata?.['display_name']
          )
        );
      }
      return activeSession;
    } else {
      if (!displayName) {
        displayName = 'guest_' + Math.floor(Math.random() * 1000);
      }
      const { data, error } = await this.supabase.auth.signInAnonymously({
        options: {
          data: { display_name: displayName },
        },
      });

      if (error) console.error(error);
      if (data?.session?.user) {
        this.session.set(data.session);
        const user = data.user ?? data.session.user;
        this.player.set(
          new Player(user.id, user.user_metadata?.['display_name'])
        );
        const {
          data: { session: refreshedSession },
        } = await this.supabase.auth.getSession();
        this.session.set(refreshedSession ?? data.session);
      }
      return data;
    }
  }

  // Helper: build headers with JWT so Edge Functions can verify identity
  private async authHeaders(): Promise<Record<string, string>> {
    const {
      data: { session },
    } = await this.supabase.auth.getSession();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    return headers;
  }

  // ✅ UPDATED: no playerUuid param, sends decks + Authorization
  async createLobby(decks: number = 1) {
    if (!(await this.fetchUser())) {
      await this.signInAnon();
    }

    const headers = await this.authHeaders();

    const { data, error } = await this.supabase.functions.invoke('create-lobby', {
      method: 'POST',
      body: JSON.stringify({ decks }),
      headers,
    });

    // Expected Edge Function response: { data: <uuid>, joinCode?: string }
    const lobbyId =
      data && typeof data === 'object' && 'data' in (data as any)
        ? (data as any).data
        : data;
    const joinCode =
      data && typeof data === 'object' && 'joinCode' in (data as any)
        ? (data as any).joinCode
        : null;

    if (lobbyId) {
      this.lobbyId.set(lobbyId);
      this.hostId.set(this.player().id);
      console.log('Lobby created with ID:', this.lobbyId());
      this.router.navigate(['/lobby/' + this.lobbyId()]);
      this.addPlayer(new Player(this.player().id, this.player().displayName));
    }

    if (error) {
      console.error('Error creating lobby:', error);
    }

    if (joinCode) {
      this.joinCode.set(joinCode);
    }

    return { lobbyId, joinCode };
  }

  async startLobbyPresence(lobbyId: string) {
    if (!lobbyId) {
      return;
    }

    await this.loadSession();
    const userId = this.player().id;
    if (!userId) {
      return;
    }

    if (this.lobbyPresenceChannel) {
      await this.stopLobbyPresence();
    }

    const channel = this.supabase.channel(`lobby:${lobbyId}`, {
      config: {
        presence: { key: userId },
      },
    });

    const syncPlayers = () => {
      const state = channel.presenceState();
      const players: Player[] = [];
      for (const [id, metas] of Object.entries(state)) {
        for (const meta of metas as Array<Record<string, unknown>>) {
          const displayName =
            (meta['displayName'] as string) ||
            (meta['display_name'] as string) ||
            'Guest';
          if (!players.some((player) => player.id === id)) {
            players.push(new Player(id, displayName));
          }
        }
      }
      this.players.set(players);
    };

    channel
      .on('presence', { event: 'sync' }, syncPlayers)
      .on('presence', { event: 'join' }, syncPlayers)
      .on('presence', { event: 'leave' }, syncPlayers)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId,
            displayName: this.player().displayName || 'Guest',
          });
        }
      });

    this.lobbyPresenceChannel = channel;
  }

  async stopLobbyPresence() {
    if (!this.lobbyPresenceChannel) {
      return;
    }
    const channel = this.lobbyPresenceChannel;
    this.lobbyPresenceChannel = undefined;
    try {
      await channel.untrack();
    } catch (error) {
      console.error(error);
    }
    this.supabase.removeChannel(channel);
  }

  // ✅ UPDATED: no playerUuid param, uses JWT
  async startRound(gameId: string) {
    const headers = await this.authHeaders();

    const { data, error } = await this.supabase.functions.invoke('start-round', {
      method: 'POST',
      body: JSON.stringify({ game_id: gameId }),
      headers,
    });

    if (error) {
      console.error('Error starting round:', error);
    }

    return data;
  }

  // ✅ UPDATED: signal-safe update (don't mutate array in place)
  addPlayer(player: Player) {
    this.players.update((list) => [...list, player]);
  }

  async signOut() {
    await this.stopLobbyPresence();
    await this.supabase.auth.signOut();
    this.session.set(null);
    this.player.set(new Player('', ''));
    this.players.set([]);
    this.lobbyId.set('');
    this.joinCode.set('');
    this.hostId.set('');
  }
}
