import type { Session } from '@supabase/supabase-js';

import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { createSelectors } from '@/lib/utils';

/**
 * Auth backed by Supabase.
 *
 * This replaces the starter's placeholder token store. It has to be real rather
 * than mocked because every row in the Story Bible is protected by RLS keyed on
 * `auth.uid()` — without a genuine session the app reads an empty database, not
 * a permissions error, which is a confusing way to fail.
 *
 * Supabase persists the session itself (MMKV-backed, see lib/supabase/client),
 * so hydrate() just asks it what it already has.
 */

type AuthState = {
  session: Session | null;
  status: 'idle' | 'signOut' | 'signIn';
  error: string | null;
  pending: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hydrate: () => Promise<void>;
};

const _useAuthStore = create<AuthState>(set => ({
  session: null,
  status: 'idle',
  error: null,
  pending: false,

  signIn: async (email, password) => {
    set({ pending: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ pending: false, error: error.message });
      return;
    }
    set({ session: data.session, status: 'signIn', pending: false });
  },

  signUp: async (email, password) => {
    set({ pending: true, error: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ pending: false, error: error.message });
      return;
    }
    // With email confirmation on, signUp returns no session — say so plainly
    // rather than leaving the user on a screen that looks stuck.
    if (!data.session) {
      set({
        pending: false,
        error: 'Check your email to confirm the account, then sign in.',
      });
      return;
    }
    set({ session: data.session, status: 'signIn', pending: false });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, status: 'signOut', error: null });
  },

  hydrate: async () => {
    const { data } = await supabase.auth.getSession();
    set(
      data.session
        ? { session: data.session, status: 'signIn' }
        : { session: null, status: 'signOut' },
    );
  },
}));

// Keep the store in step with token refreshes and sign-outs that happen
// outside these actions.
supabase.auth.onAuthStateChange((_event, session) => {
  _useAuthStore.setState(
    session
      ? { session, status: 'signIn' }
      : { session: null, status: 'signOut' },
  );
});

export const useAuthStore = createSelectors(_useAuthStore);

export const signOut = () => _useAuthStore.getState().signOut();
export const hydrateAuth = () => _useAuthStore.getState().hydrate();
