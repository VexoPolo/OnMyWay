import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle> };

/** Pressable with the one thing every tappable needs: visible pressed feedback and a button role. */
export function Tap({ style, ...rest }: Props) {
  return <Pressable accessibilityRole="button" {...rest} style={({ pressed }) => [style, pressed && { opacity: 0.7 }]} />;
}
