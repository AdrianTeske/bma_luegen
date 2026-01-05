import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class LobbyCodeService {
  private supabase!: SupabaseClient;

  constructor() {
    const supabaseUrl = environment.supabaseUrl;
    const supabaseKey = environment.supabaseAnonKey;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: true,
          detectSessionInUrl: false,
        },
      });
    }
  }

  private normalizeCode(code: string) {
    return code.trim().toUpperCase().replace(/\s+/g, '');
  }

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

  async resolveLobbyCode(code: string): Promise<string | null> {
    const normalized = this.normalizeCode(code);
    if (!normalized) {
      return null;
    }

    const headers = await this.authHeaders();

    const { data, error } = await this.supabase.functions.invoke(
      'resolve-lobby-code',
      {
        method: 'POST',
        body: JSON.stringify({ code: normalized }),
        headers,
      }
    );

    if (error) {
      console.error('Error resolving lobby code:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    if (typeof data === 'string') {
      return data;
    }

    if (typeof data === 'object') {
      if ('lobbyId' in data) {
        return (data as { lobbyId: string }).lobbyId;
      }
      if ('lobby_id' in data) {
        return (data as { lobby_id: string }).lobby_id;
      }
      if ('data' in data) {
        const wrapped = (data as { data: unknown }).data;
        return typeof wrapped === 'string' ? wrapped : null;
      }
    }

    return null;
  }
}
