import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

interface Props extends TextInputProps {
  label: string;
  error?: string;
}

export function Field({ label, error, style, ...rest }: Props) {
  return (
    <View style={s.wrap}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={[s.input, !!error && s.inputError, style]} {...rest} />
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: colors.muted },
  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  inputError: { borderColor: colors.error },
  error: { fontFamily: fonts.body, fontSize: 12, color: colors.error },
});
