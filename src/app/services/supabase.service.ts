import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private supabase!: SupabaseClient;

  constructor() {
    const supabaseUrl = environment.supabaseUrl;
    const supabaseKey = environment.supabaseAnonKey;

    try {
      if (supabaseUrl && supabaseKey) {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            // disable automatic token refresh which relies on Navigator Lock API
            autoRefreshToken: false,
            // keep session persistence behavior as desired
            persistSession: true,
            // avoid URL session detection in SPA routing
            detectSessionInUrl: false,
          },
        });
      }
    } catch (error) {
      console.error(error);
    }
  }

  getUser() {
    return this.supabase.auth.getUser();
  }

  async createUser(email: string, password: string, displayName?: string) {
    this.supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          display_name: displayName,
        },
      },
    }).then((response) => {
      console.log(response);
    });
  }

  async signInAnon(displayName: string) {
    const { data, error } = await this.supabase.auth.signInAnonymously({
      options: {
        data: {
          display_name: displayName || 'guest_' + Math.floor(Math.random()*1000),
        },
      }
    });

    if (error) console.error(error);
    return data;
  }

  async createLobby() {
    const { data, error } = await this.supabase.functions.invoke('CreateLobby', {
      method: 'POST',
      body: JSON.stringify({ name: 'Functions' }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (error) console.error(error);
    return data;
  }
}
