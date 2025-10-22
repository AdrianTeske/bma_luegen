import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
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
            detectSessionInUrl: false
          }
        });
      }
    } catch (error) {
      console.error(error);
    }
  }

  getPlayers() {
    return this.supabase.from('player').select('*');
  }
}
