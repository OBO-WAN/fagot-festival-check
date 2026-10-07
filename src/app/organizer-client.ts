import { InjectionToken } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

let organizerClient: SupabaseClient | null = null;

export const ORGANIZER_CLIENT = new InjectionToken<SupabaseClient | null>('Organizer Supabase client', {
  providedIn: 'root',
  factory: () => {
    if (typeof window === 'undefined' || !environment.supabaseUrl || !environment.supabasePublishableKey) return null;
    // A separate, tab-scoped session keeps the public submission form anonymous.
    if (!organizerClient) {
      try {
        organizerClient = createClient(environment.supabaseUrl, environment.supabasePublishableKey, {
          auth: { storageKey: 'festival-organizer-session', storage: window.sessionStorage, detectSessionInUrl: false },
        });
      } catch {
        return null;
      }
    }
    return organizerClient;
  },
});
