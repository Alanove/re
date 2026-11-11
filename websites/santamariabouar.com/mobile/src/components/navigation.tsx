import { Image, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

import { brand, fontFamilies } from '@/theme';

/** White sticky header like the website (`.site-header`). */
export const headerOptions = {
  headerStyle: { backgroundColor: brand.white },
  headerTintColor: brand.darkText,
  headerTitleStyle: { fontFamily: fontFamilies.bold, color: brand.darkText, fontSize: 18 },
  headerShadowVisible: true,
  contentStyle: { backgroundColor: brand.cream }
} as const;

export const tabOptions = {
  ...headerOptions,
  sceneStyle: { backgroundColor: brand.cream },
  tabBarActiveTintColor: brand.primary,
  tabBarInactiveTintColor: brand.lightText,
  tabBarStyle: { backgroundColor: brand.white, borderTopColor: brand.border },
  tabBarLabelStyle: { fontFamily: fontFamilies.medium, fontSize: 11 }
} as const;

/** Header title with the site logo mark, used on top-level screens. */
export function LogoTitle({ title }: { title?: string }) {
  return (
    <View style={styles.row}>
      <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} resizeMode="contain" />
      {title ? (
        <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 46, height: 30 },
  title: { color: brand.darkText }
});
