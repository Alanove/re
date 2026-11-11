import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FAB, Button as PaperButton, Card as PaperCard, Searchbar, Text } from 'react-native-paper';

import { alertPalette, brand, cardStyle, fontFamilies } from '@/theme';
import { formatMoney, plainLabel } from '@/utils/format';

type PaperButtonProps = ComponentProps<typeof PaperButton>;

interface ButtonProps extends PaperButtonProps {
  /** Website button styles: primary (orange), secondary (golden brown), danger. */
  tone?: 'primary' | 'secondary' | 'danger';
}

export function Button({ tone = 'primary', mode = 'text', style, labelStyle, contentStyle, ...rest }: ButtonProps) {
  const filled = mode === 'contained';
  const buttonColor = filled ? (tone === 'secondary' ? brand.goldenBrown : tone === 'danger' ? brand.danger : undefined) : undefined;
  const textColor = !filled && tone === 'danger' ? brand.danger : !filled && tone === 'secondary' ? brand.goldenBrown : undefined;
  return (
    <PaperButton
      mode={mode}
      buttonColor={buttonColor}
      textColor={textColor}
      {...rest}
      style={[styles.button, mode === 'outlined' && styles.outlined, style]}
      labelStyle={[styles.buttonLabel, labelStyle]}
      contentStyle={[mode === 'contained' || mode === 'outlined' || mode === 'contained-tonal' ? styles.buttonContent : null, contentStyle]}
    />
  );
}

type PaperCardProps = ComponentProps<typeof PaperCard>;

function CardRoot({ style, mode: _mode, children, ...rest }: PaperCardProps) {
  return (
    <PaperCard mode="contained" {...(rest as object)} style={[cardStyle, style as StyleProp<ViewStyle>]}>
      {children}
    </PaperCard>
  );
}

function CardTitle(props: ComponentProps<typeof PaperCard.Title>) {
  return (
    <PaperCard.Title
      titleVariant="titleMedium"
      subtitleVariant="bodySmall"
      {...props}
      titleStyle={[{ color: brand.darkText }, props.titleStyle]}
      subtitleStyle={[{ color: brand.lightText }, props.subtitleStyle]}
    />
  );
}

/** Website "account-card": white, 1px beige border, 12px radius, soft shadow. */
export const Card = Object.assign(CardRoot, {
  Title: CardTitle,
  Content: PaperCard.Content,
  Cover: PaperCard.Cover,
  Actions: PaperCard.Actions
});

interface AlertProps {
  tone?: keyof typeof alertPalette;
  visible?: boolean;
  children: ReactNode;
}

/** Website "account-alert" banner. */
export function Alert({ tone = 'info', visible = true, children }: AlertProps) {
  if (!visible || !children) return null;
  const palette = alertPalette[tone];
  return (
    <View style={[styles.alert, { backgroundColor: palette.background }]}>
      <MaterialCommunityIcons name={palette.icon} size={20} color={palette.text} />
      <Text variant="bodyMedium" style={[styles.alertText, { color: palette.text }]}>
        {children}
      </Text>
    </View>
  );
}

/** Small uppercase label used across the website portal. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Text variant="labelSmall" style={[styles.eyebrow, style as never]}>
      {children}
    </Text>
  );
}

/** Website "account-summary__item": cream tile with label and bold value. */
export function StatTile({
  label,
  value,
  hint,
  valueColor,
  onPress,
  style
}: {
  label: string;
  value: string;
  hint?: string;
  valueColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const content = (
    <View style={styles.statInner}>
      <Eyebrow>{label}</Eyebrow>
      <Text variant="titleLarge" style={[styles.statValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
      {hint ? (
        <Text variant="bodySmall" style={styles.muted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
  return (
    <PaperCard mode="contained" onPress={onPress} style={[styles.stat, style]}>
      {content}
    </PaperCard>
  );
}

/** Website "account-total-due" highlight. */
export function TotalDue({ label, amount, note }: { label: string; amount: number; note?: string }) {
  return (
    <View style={styles.totalDue}>
      <View style={styles.totalDueRow}>
        <Text variant="titleSmall" style={{ color: brand.darkText }}>
          {label}
        </Text>
        <Text variant="headlineSmall" style={styles.totalDueAmount}>
          {formatMoney(amount)}
        </Text>
      </View>
      {note ? (
        <Text variant="bodyMedium" style={{ color: brand.darkText }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

/** Website "account-info-list": cream tiles with a small label and the value. */
export function InfoGrid({ items }: { items: ({ label: string; value: string } | null | false)[] }) {
  return (
    <View style={styles.infoGrid}>
      {items
        .filter((item): item is { label: string; value: string } => Boolean(item))
        .map((item) => (
          <View key={item.label} style={styles.infoItem}>
            <Eyebrow>{plainLabel(item.label)}</Eyebrow>
            <Text variant="bodyLarge" style={styles.infoValue}>
              {item.value}
            </Text>
          </View>
        ))}
    </View>
  );
}

/** Website "account-badge" default pill (beige). */
export function Pill({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.pill, style]}>
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

/** Website form-control look for search inputs. */
export function SearchField(props: ComponentProps<typeof Searchbar>) {
  return (
    <Searchbar
      elevation={0}
      iconColor={brand.lightText}
      placeholderTextColor={brand.lightText}
      {...props}
      style={[styles.search, props.style]}
      inputStyle={[styles.searchInput, props.inputStyle]}
    />
  );
}

/** Floating orange "add" button. */
export function AddFab({ onPress, icon = 'plus' }: { onPress: () => void; icon?: string }) {
  return <FAB icon={icon} color={brand.white} style={styles.fab} onPress={onPress} />;
}

/** White bordered container that makes a list row read as a website table card. */
export function ListRow({ children }: { children: ReactNode }) {
  return <View style={styles.listRow}>{children}</View>;
}

/** Orange initials circle, as in the website account sidebar. */
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: 8 },
  outlined: { borderColor: brand.primary },
  buttonLabel: { fontFamily: fontFamilies.medium, fontSize: 15, letterSpacing: 0.2 },
  buttonContent: { paddingVertical: 4 },
  alert: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 14, borderRadius: 8 },
  alertText: { flex: 1, lineHeight: 20 },
  eyebrow: {
    color: brand.lightText,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: fontFamilies.bold,
    fontSize: 11
  },
  stat: { backgroundColor: brand.cream, borderColor: brand.border, borderWidth: 1, borderRadius: 10 },
  statInner: { padding: 14, gap: 4 },
  statValue: { color: brand.darkText },
  muted: { color: brand.lightText },
  totalDue: { backgroundColor: 'rgba(200, 126, 47, 0.1)', borderRadius: 10, padding: 16, gap: 6 },
  totalDueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalDueAmount: { color: brand.accent },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  infoItem: {
    flexGrow: 1,
    flexBasis: '45%',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: brand.cream,
    borderColor: brand.border,
    borderWidth: 1,
    borderRadius: 8
  },
  infoValue: { color: brand.darkText, fontFamily: fontFamilies.medium },
  pill: { alignSelf: 'flex-start', backgroundColor: brand.beige, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillText: { color: brand.darkText, fontSize: 11, fontFamily: fontFamilies.bold, textTransform: 'uppercase', letterSpacing: 0.4 },
  search: { backgroundColor: brand.white, borderColor: brand.border, borderWidth: 1, borderRadius: 8, height: 48 },
  searchInput: { color: brand.darkText, fontFamily: fontFamilies.regular, minHeight: 0 },
  fab: { position: 'absolute', right: 16, bottom: 16, backgroundColor: brand.primary, borderRadius: 16 },
  listRow: {
    backgroundColor: brand.white,
    borderColor: brand.border,
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    overflow: 'hidden'
  },
  avatar: { backgroundColor: brand.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: brand.white, fontFamily: fontFamilies.bold }
});
