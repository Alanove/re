import { Control, Controller, FieldPath, FieldValues } from 'react-hook-form';
import { View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';
import type { TextInputProps } from 'react-native-paper';

import { brand } from '@/theme';

/** Outlined input styled like the website form fields. */
export const inputStyleProps = {
  mode: 'outlined' as const,
  outlineColor: brand.border,
  activeOutlineColor: brand.primary,
  outlineStyle: { borderRadius: 8 },
  style: { backgroundColor: brand.white }
};

interface FormTextFieldProps<T extends FieldValues> extends Omit<TextInputProps, 'value' | 'onChangeText' | 'error'> {
  control: Control<T>;
  name: FieldPath<T>;
}

export function FormTextField<T extends FieldValues>({ control, name, ...inputProps }: FormTextFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange, onBlur }, fieldState: { error } }) => (
        <View>
          <TextInput
            {...inputStyleProps}
            {...inputProps}
            value={value == null ? '' : String(value)}
            onChangeText={onChange}
            onBlur={onBlur}
            error={Boolean(error)}
          />
          {error?.message ? <HelperText type="error">{error.message}</HelperText> : null}
        </View>
      )}
    />
  );
}
