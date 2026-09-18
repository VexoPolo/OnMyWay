import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { brandGradient, colors, fonts, radius } from '../theme';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/** Primary = brand gradient with #1F1300 label. Never white on yellow. */
export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const inactive = disabled || loading;
  if (variant === 'primary') {
    return (
      <Pressable
        onPress={onPress}
        disabled={inactive}
        style={({ pressed }) => [s.wrap, style, pressed && s.pressed, inactive && s.dim]}
      >
        <LinearGradient colors={[...brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.fill}>
          {loading ? <ActivityIndicator color={colors.onBrand} /> : <Text style={s.primaryLabel}>{title}</Text>}
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        s.wrap,
        s.fill,
        variant === 'ghost' ? s.ghost : s.danger,
        style,
        pressed && s.pressed,
        inactive && s.dim,
      ]}
    >
      <Text style={[s.label, variant === 'danger' && { color: colors.error }]}>{title}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: radius.button, overflow: 'hidden' },
  fill: { height: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  ghost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.error },
  primaryLabel: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.onBrand },
  label: { fontFamily: fonts.bodySemi, fontSize: 16, color: colors.ink },
  pressed: { opacity: 0.85 },
  dim: { opacity: 0.5 },
});
