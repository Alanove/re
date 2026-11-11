import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { HelperText, List, Menu, TextInput } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

import { brand } from '@/theme';
import { inputStyleProps } from './FormTextField';

export interface SelectOption<T extends string | number> {
  value: T;
  label: string;
  description?: string;
}

interface SelectFieldProps<T extends string | number> {
  label: string;
  value: T | null | undefined;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  error?: string;
  disabled?: boolean;
}

export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  error,
  disabled
}: SelectFieldProps<T>) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View>
      <Menu
        visible={open}
        onDismiss={() => setOpen(false)}
        anchorPosition="bottom"
        contentStyle={styles.menuContent}
        anchor={
          <TextInput
            {...inputStyleProps}
            label={label}
            value={selected?.label || ''}
            placeholder={t('common.select')}
            editable={false}
            disabled={disabled}
            error={Boolean(error)}
            right={<TextInput.Icon icon="menu-down" onPress={() => !disabled && setOpen(true)} />}
            onPressIn={() => !disabled && setOpen(true)}
          />
        }>
        <ScrollView style={styles.menu}>
          {options.map((option) => (
            <List.Item
              key={String(option.value)}
              title={option.label}
              description={option.description}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
              }}
            />
          ))}
        </ScrollView>
      </Menu>
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  menu: { maxHeight: 320 },
  menuContent: { backgroundColor: brand.white, borderRadius: 8 }
});
