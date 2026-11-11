import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Dialog, HelperText, List, Portal, Searchbar, TextInput } from 'react-native-paper';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { ApartmentOption } from '@/api/types';
import { brand } from '@/theme';
import { inputStyleProps } from './FormTextField';
import { Button } from './ui';
import { useDebouncedValue } from './useDebouncedValue';

interface ApartmentPickerProps {
  label?: string;
  value: ApartmentOption | null;
  onChange: (apartment: ApartmentOption | null) => void;
  /** Server-side search (admin). Either this or `options` must be given. */
  search?: (term: string) => Promise<ApartmentOption[]>;
  /** Client-side list (request access). */
  options?: ApartmentOption[];
  error?: string;
  allowClear?: boolean;
}

export function ApartmentPicker({ label, value, onChange, search, options, error, allowClear }: ApartmentPickerProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const debounced = useDebouncedValue(term, 300);

  const remote = useQuery({
    queryKey: ['apartment-search', debounced],
    queryFn: () => search!(debounced),
    enabled: open && Boolean(search)
  });

  const items = useMemo(() => {
    if (search) return remote.data || [];
    const lower = term.toLowerCase().trim();
    return (options || []).filter((o) => !lower || o.label.toLowerCase().includes(lower));
  }, [search, remote.data, options, term]);

  return (
    <View>
      <TextInput
        {...inputStyleProps}
        label={label || t('common.apartment')}
        value={value?.label || ''}
        placeholder={t('common.selectApartment')}
        editable={false}
        error={Boolean(error)}
        onPressIn={() => setOpen(true)}
        right={
          value && allowClear ? (
            <TextInput.Icon icon="close" onPress={() => onChange(null)} />
          ) : (
            <TextInput.Icon icon="magnify" onPress={() => setOpen(true)} />
          )
        }
      />
      {error ? <HelperText type="error">{error}</HelperText> : null}
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)} style={styles.dialog}>
          <Dialog.Title>{label || t('common.selectApartment')}</Dialog.Title>
          <Dialog.Content style={styles.content}>
            <Searchbar
              placeholder={t('common.search')}
              value={term}
              onChangeText={setTerm}
              autoFocus
              style={styles.search}
            />
            {search && remote.isFetching ? <ActivityIndicator style={styles.spinner} /> : null}
            <FlatList
              data={items}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <List.Item
                  title={item.label}
                  description={item.ownerName || undefined}
                  onPress={() => {
                    onChange(item);
                    setOpen(false);
                  }}
                />
              )}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>{t('common.close')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  dialog: { maxHeight: '85%', backgroundColor: brand.white, borderRadius: 12 },
  search: { backgroundColor: brand.cream, borderRadius: 8, borderWidth: 1, borderColor: brand.border },
  content: { height: 420, gap: 8 },
  spinner: { marginVertical: 8 }
});
