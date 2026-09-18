import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '../theme';

interface Props {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  error?: boolean;
}

/** Six boxes, one hidden input. Filled boxes get the brand border. */
export function OtpInput({ value, onChange, length = 6, error }: Props) {
  const ref = useRef<TextInput>(null);
  const digits = value.padEnd(length).split('').slice(0, length);
  return (
    <Pressable onPress={() => ref.current?.focus()} style={s.row}>
      {digits.map((d, i) => {
        const filled = d.trim() !== '';
        const active = i === Math.min(value.length, length - 1);
        return (
          <View key={i} style={[s.box, filled && s.filled, active && s.active, error && s.error]}>
            <Text style={s.digit}>{d.trim()}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, '').slice(0, length))}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        style={s.hidden}
        caretHidden
      />
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  box: {
    width: 48,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { borderColor: colors.brandB },
  active: { borderColor: colors.brandDark },
  error: { borderColor: colors.error },
  digit: { fontFamily: fonts.monoMedium, fontSize: 22, color: colors.ink },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
