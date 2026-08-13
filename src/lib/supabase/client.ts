import type { SupportedStorage } from '@supabase/supabase-js';
import type { Database } from './types';

import { createClient } from '@supabase/supabase-js';
import Env from 'env';
import { AppState } from 'react-native';
import { storage } from '@/lib/storage';

import 'react-native-url-polyfill/auto';

/**
 * Session storage backed by MMKV (encrypted) rather than AsyncStorage, per the
 * project convention for sensitive data.
 */
const mmkvStorage: SupportedStorage = {
  getItem: key => storage.getString(key) ?? null,
  setItem: (key, value) => {
    storage.set(key, value);
  },
  removeItem: (key) => {
    storage.remove(key);
  },
};

/**
 * False until a real Supabase project is provisioned and the keys land in
 * `.env`. Gate any screen that reads the Story Bible on this so the app still
 * boots during Spike 0 instead of throwing at import time.
 */
export const isSupabaseConfigured
  = Env.EXPO_PUBLIC_SUPABASE_URL !== '' && Env.EXPO_PUBLIC_SUPABASE_ANON_KEY !== '';

if (!isSupabaseConfigured && __DEV__) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are unset — Story Bible '
    + 'calls will fail. Fill them in .env (see .env.example).',
  );
}

// createClient throws on an empty URL, so fall back to an obviously-fake origin
// and let `isSupabaseConfigured` be the thing callers check.
export const supabase = createClient<Database>(
  isSupabaseConfigured ? Env.EXPO_PUBLIC_SUPABASE_URL : 'http://unconfigured.invalid',
  isSupabaseConfigured ? Env.EXPO_PUBLIC_SUPABASE_ANON_KEY : 'unconfigured',
  {
    auth: {
      storage: mmkvStorage,
      autoRefreshToken: true,
      persistSession: true,
      // No URL-based session detection in a native app.
      detectSessionInUrl: false,
    },
  },
);

/**
 * Supabase only refreshes tokens while the app is in the foreground; without
 * this the session goes stale after backgrounding.
 */
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  }
  else {
    supabase.auth.stopAutoRefresh();
  }
});
