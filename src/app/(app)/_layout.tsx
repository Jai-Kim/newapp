import { Link, Redirect, SplashScreen, Tabs } from 'expo-router';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Button,
  Pressable,
  Text,
  View,
} from '@/components/ui';
import {
  Feed as FeedIcon,
  Settings as SettingsIcon,
  Style as StyleIcon,
} from '@/components/ui/icons';
import { useAuthStore as useAuth } from '@/features/auth/use-auth-store';
import { messageOf } from '@/lib/errors';
import { useIsFirstTime } from '@/lib/hooks/use-is-first-time';
import { getMyChild } from '@/lib/supabase/onboarding';

/**
 * Where a signed-in parent belongs: setup, the look picker, or the app.
 *
 * The distinction that matters here is between *no child* and *no answer*.
 * A missing child is an answer — it is exactly what a parent who just signed
 * up looks like, and it means "go to child setup". A read that fails is not an
 * answer, and must never be quietly rounded to one: this gate used to treat
 * any failure as "setup is done", so a single 401 (an auth token a moment out
 * of step with the server's clock will do it) left a brand-new parent on the
 * Tonight tab with an empty lesson picker whose button does nothing, and no
 * way forward for the rest of the session.
 */
type SetupState
  = | { kind: 'checking' }
    | { kind: 'ready'; hasChild: boolean; hasLook: boolean }
    | { kind: 'error'; message: string };

/**
 * A failed read here is never something the parent did, and is usually a blip
 * — a token a second out of step, a request sent as the network came back. So
 * it is retried before anyone is asked to look at an error, and the retry
 * button exists for the times that is not enough.
 */
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [400, 1200];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function useSetupState(status: 'idle' | 'signOut' | 'signIn') {
  const [setup, setSetup] = useState<SetupState>({ kind: 'checking' });
  // Bumped by the retry button. The effect keys on this as well as `status`,
  // because keying on `status` alone meant a parent whose one check failed
  // could never re-run it — the status never changes again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (status !== 'signIn') {
      return;
    }

    let cancelled = false;

    (async () => {
      setSetup({ kind: 'checking' });

      for (let tries = 0; tries < MAX_ATTEMPTS; tries++) {
        try {
          const child = await getMyChild();
          if (cancelled) {
            return;
          }
          setSetup({
            kind: 'ready',
            hasChild: child !== null,
            // Separate from hasChild: a child can exist with no character
            // sheet, and that child cannot be illustrated yet.
            hasLook: child?.character_ref != null,
          });
          return;
        }
        catch (error) {
          if (cancelled) {
            return;
          }
          if (tries === MAX_ATTEMPTS - 1) {
            setSetup({ kind: 'error', message: messageOf(error) });
            return;
          }
          await delay(RETRY_BACKOFF_MS[tries]);
          if (cancelled) {
            return;
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, attempt]);

  return {
    setup,
    retry: useCallback(() => setAttempt(n => n + 1), []),
  };
}

export default function TabLayout() {
  const status = useAuth.use.status();
  const [isFirstTime] = useIsFirstTime();
  const { setup, retry } = useSetupState(status);

  const hideSplash = useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);
  useEffect(() => {
    if (status !== 'idle') {
      const timer = setTimeout(() => {
        hideSplash();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hideSplash, status]);

  if (isFirstTime) {
    return <Redirect href="/onboarding" />;
  }
  if (status === 'signOut') {
    return <Redirect href="/login" />;
  }

  if (status === 'signIn') {
    if (setup.kind === 'error') {
      return (
        <SetupError message={setup.message} onRetry={retry} />
      );
    }
    if (setup.kind === 'ready' && !setup.hasChild) {
      return <Redirect href="/child-setup" />;
    }
    if (setup.kind === 'ready' && !setup.hasLook) {
      return <Redirect href="/character-setup" />;
    }
  }

  // Still deciding. Showing the app shell here would flash a screen the parent
  // may not belong on — and, for a parent with no child yet, one that cannot
  // do anything.
  if (setup.kind === 'checking') {
    return (
      <View className="flex-1 items-center justify-center" testID="setup-checking">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Storybook',
          tabBarIcon: ({ color }) => <FeedIcon color={color} />,
          headerRight: () => <CreateNewPostLink />,
          tabBarButtonTestID: 'feed-tab',
        }}
      />

      <Tabs.Screen
        name="review"
        options={{
          title: 'Review',
          tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
          tabBarButtonTestID: 'review-tab',
        }}
      />
      <Tabs.Screen
        name="style"
        options={{
          title: 'Style',
          headerShown: false,
          tabBarIcon: ({ color }) => <StyleIcon color={color} />,
          tabBarButtonTestID: 'style-tab',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
          tabBarButtonTestID: 'settings-tab',
        }}
      />
    </Tabs>
  );
}

/**
 * Deliberately a dead end with one way out. The alternative — dropping the
 * parent into the app — is what caused the bug this replaces.
 */
function SetupError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-4 p-6" testID="setup-error">
      <Text className="text-xl font-bold">We couldn't load your account</Text>
      <Text className="text-center text-neutral-600 dark:text-neutral-400">
        {message}
      </Text>
      <Button label="Try again" onPress={onRetry} testID="setup-retry" />
    </View>
  );
}

function CreateNewPostLink() {
  return (
    <Link href="/feed/add-post" asChild>
      <Pressable>
        <Text className="px-3 text-primary-300">Create</Text>
      </Pressable>
    </Link>
  );
}
