import type { StyleProp, TextStyle } from 'react-native';
import { Text } from 'react-native-paper';
import type { MD3TypescaleKey } from 'react-native-paper';
import { statusColors } from '@/theme';
import { formatMoney } from '@/utils/format';

type Tone = 'income' | 'expense' | 'neutral';

interface AmountTextProps {
  value: number;
  tone?: Tone;
  variant?: keyof typeof MD3TypescaleKey;
  style?: StyleProp<TextStyle>;
}

export function AmountText({ value, tone = 'neutral', variant, style }: AmountTextProps) {
  const color = tone === 'neutral' ? undefined : statusColors[tone];
  const prefix = tone === 'expense' && value > 0 ? '-' : '';
  return (
    <Text variant={variant} style={[{ fontVariant: ['tabular-nums'], fontWeight: '600' }, color ? { color } : null, style]}>
      {`${prefix}${formatMoney(value)}`}
    </Text>
  );
}
