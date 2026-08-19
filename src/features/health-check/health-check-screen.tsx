import type { HealthCheckResponse, ProviderCheck } from '@/lib/supabase';
import { useState } from 'react';

import {
  ActivityIndicator,
  Button,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';

import { messageOf } from '@/lib/errors';
import { healthCheck, isSupabaseConfigured } from '@/lib/supabase';

/**
 * Spike 0's done-condition made visible: the app boots, and one tap proves the
 * server layer can reach Supabase, Claude, and the image provider.
 *
 * Dev-facing only — this is a build/no-build gate instrument, not a product
 * screen. It should not survive into the Week 2 core loop.
 */
export function HealthCheckScreen() {
  const [result, setResult] = useState<HealthCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const run = async () => {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      setResult(await healthCheck());
    }
    catch (err) {
      setError(messageOf(err));
    }
    finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 gap-4 p-4">
          <Text className="text-xl font-bold">Spike 0 — provider health</Text>
          <Text className="text-neutral-600 dark:text-neutral-400">
            Calls the
            {' '}
            <Text className="font-bold">health-check</Text>
            {' '}
            Edge Function, which
            pings Supabase, the Anthropic API, and the image provider using
            server-side keys.
          </Text>

          {!isSupabaseConfigured && (
            <View className="rounded-md bg-warning-100 p-3 dark:bg-warning-900">
              <Text className="text-warning-800 dark:text-warning-100">
                Supabase isn't configured yet. Set EXPO_PUBLIC_SUPABASE_URL and
                EXPO_PUBLIC_SUPABASE_ANON_KEY in .env, then restart with
                {' '}
                <Text className="font-bold">pnpm start -c</Text>
                .
              </Text>
            </View>
          )}

          <Button
            label={isRunning ? 'Running…' : 'Run health check'}
            disabled={isRunning || !isSupabaseConfigured}
            onPress={run}
            testID="run-health-check"
          />

          {isRunning && <ActivityIndicator />}

          {error !== null && (
            <View className="rounded-md bg-danger-100 p-3 dark:bg-danger-900">
              <Text className="text-danger-800 dark:text-danger-100">
                {error}
              </Text>
            </View>
          )}

          {result !== null && (
            <View className="gap-2">
              <Text className="text-lg font-bold">
                {result.ok ? 'All providers reachable' : 'Some checks failed'}
              </Text>
              <CheckRow name="Supabase" check={result.checks.supabase} />
              <CheckRow name="Claude" check={result.checks.anthropic} />
              <CheckRow name="Image provider" check={result.checks.image} />
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

function CheckRow({ name, check }: { name: string; check: ProviderCheck }) {
  return (
    <View className="rounded-md border border-neutral-200 p-3 dark:border-neutral-700">
      <View className="flex-row justify-between">
        <Text className="font-bold">
          {check.ok ? '✅' : '❌'}
          {' '}
          {name}
        </Text>
        {check.latency_ms !== undefined && (
          <Text className="text-neutral-500">
            {check.latency_ms}
            ms
          </Text>
        )}
      </View>
      <Text className="text-neutral-600 dark:text-neutral-400">
        {check.detail}
      </Text>
    </View>
  );
}
