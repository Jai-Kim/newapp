import Env from 'env';
import { useRouter } from 'expo-router';
import { useUniwind } from 'uniwind';

import {
  Button,
  colors,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { Github, Rate, Share, Support, Website } from '@/components/ui/icons';
import { useAuthStore as useAuth } from '@/features/auth/use-auth-store';
import { translate } from '@/lib/i18n';
import { readCachedChild } from '@/lib/offline/chapter-cache';
import { useProEntitlement } from '@/lib/purchases/use-pro-entitlement';
import { LanguageItem } from './components/language-item';
import { SettingsContainer } from './components/settings-container';
import { SettingsItem } from './components/settings-item';
import { ThemeItem } from './components/theme-item';

/**
 * Subscription status + entry point to the paywall (issue #14, ADR-0003).
 * Bilingual EN+KO like the rest of the product, unlike the surrounding
 * template chrome (which only has EN/AR i18n resources) — so this is a
 * hand-rolled block rather than a `SettingsItem`, whose `text` prop is
 * locked to that i18n key set.
 */
function SubscriptionSection() {
  const router = useRouter();
  const { isPro, loading } = useProEntitlement();
  const lead = readCachedChild()?.primary_language ?? 'en';

  const primary = isPro
    ? (lead === 'ko' ? '구독 중이에요 — 고마워요!' : 'Subscribed — thank you!')
    : (lead === 'ko' ? '아직 구독하지 않았어요' : 'Not subscribed yet');
  const secondary = isPro
    ? (lead === 'ko' ? 'Subscribed — thank you!' : '구독 중이에요 — 고마워요!')
    : (lead === 'ko' ? 'Not subscribed yet' : '아직 구독하지 않았어요');

  return (
    <View className="mb-6 gap-2 rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <Text className="font-bold">{primary}</Text>
      <Text className="text-neutral-500">{secondary}</Text>
      {!loading && (
        <Button
          testID="settings-paywall"
          label={isPro
            ? (lead === 'ko' ? '구독 관리 / 구매 복원' : 'Manage / restore purchases')
            : (lead === 'ko' ? '구독하기' : 'Subscribe')}
          onPress={() => router.push('/paywall')}
        />
      )}
    </View>
  );
}

export function SettingsScreen() {
  const router = useRouter();
  const signOut = useAuth.use.signOut();
  const { theme } = useUniwind();
  const iconColor
    = theme === 'dark' ? colors.neutral[400] : colors.neutral[500];
  return (
    <>
      <FocusAwareStatusBar />

      <ScrollView>
        <View className="flex-1 px-4 pt-16">
          <Text className="text-xl font-bold">
            {translate('settings.title')}
          </Text>

          <SubscriptionSection />

          <SettingsContainer title="settings.generale">
            <LanguageItem />
            <ThemeItem />
          </SettingsContainer>

          <SettingsContainer title="settings.about">
            <SettingsItem
              text="settings.app_name"
              value={Env.EXPO_PUBLIC_NAME}
            />
            <SettingsItem
              text="settings.version"
              value={Env.EXPO_PUBLIC_VERSION}
            />
          </SettingsContainer>

          <SettingsContainer title="settings.support_us">
            <SettingsItem
              text="settings.share"
              icon={<Share color={iconColor} />}
              onPress={() => {}}
            />
            <SettingsItem
              text="settings.rate"
              icon={<Rate color={iconColor} />}
              onPress={() => {}}
            />
            <SettingsItem
              text="settings.support"
              icon={<Support color={iconColor} />}
              onPress={() => {}}
            />
          </SettingsContainer>

          <SettingsContainer title="settings.links">
            <SettingsItem
              text="settings.privacy"
              onPress={() => router.push('/privacy')}
            />
            <SettingsItem text="settings.terms" onPress={() => {}} />
            <SettingsItem
              text="settings.github"
              icon={<Github color={iconColor} />}
              onPress={() => {}}
            />
            <SettingsItem
              text="settings.website"
              icon={<Website color={iconColor} />}
              onPress={() => {}}
            />
          </SettingsContainer>

          <View className="my-8">
            <SettingsContainer>
              <SettingsItem text="settings.logout" onPress={signOut} />
            </SettingsContainer>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
