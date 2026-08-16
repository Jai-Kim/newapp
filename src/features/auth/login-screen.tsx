import type { LoginFormProps } from './components/login-form';

import { useRouter } from 'expo-router';
import * as React from 'react';

import { FocusAwareStatusBar, Text, View } from '@/components/ui';
import { LoginForm } from './components/login-form';
import { useAuthStore } from './use-auth-store';

export function LoginScreen() {
  const router = useRouter();
  const signIn = useAuthStore.use.signIn();
  const signUp = useAuthStore.use.signUp();
  const error = useAuthStore.use.error();
  const pending = useAuthStore.use.pending();
  const status = useAuthStore.use.status();
  const [isNewAccount, setIsNewAccount] = React.useState(false);

  React.useEffect(() => {
    if (status === 'signIn') {
      router.replace('/');
    }
  }, [status, router]);

  const onSubmit: LoginFormProps['onSubmit'] = async (data) => {
    if (isNewAccount) {
      await signUp(data.email, data.password);
    }
    else {
      await signIn(data.email, data.password);
    }
  };

  return (
    <>
      <FocusAwareStatusBar />
      <LoginForm onSubmit={onSubmit} />
      <View className="gap-3 px-4 pb-10">
        {error !== null && (
          <View className="rounded-md bg-danger-100 p-3 dark:bg-danger-900">
            <Text className="text-danger-800 dark:text-danger-100">{error}</Text>
          </View>
        )}
        {pending && <Text className="text-neutral-500">Signing in…</Text>}
        <Text
          className="text-primary-600 dark:text-primary-400"
          onPress={() => setIsNewAccount(v => !v)}
        >
          {isNewAccount
            ? 'Already have an account? Sign in'
            : 'New here? Create an account'}
        </Text>
      </View>
    </>
  );
}
