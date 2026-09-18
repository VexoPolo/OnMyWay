import { StyleSheet, Text as RNText, TextProps } from 'react-native';
import { colors, fonts, type } from '../theme';

type Kind = 'h1' | 'title' | 'subtitle' | 'body' | 'caption' | 'mono' | 'eyebrow' | 'state';

/** Typographic roles from the handoff. `state` renders an ORDER_STATE label in mono yellow. */
export function T({ kind = 'body', style, ...rest }: TextProps & { kind?: Kind }) {
  return <RNText style={[s.base, s[kind], style]} {...rest} />;
}

const s = StyleSheet.create({
  base: { color: colors.ink, fontFamily: fonts.body, fontSize: type.body },
  h1: {
    fontFamily: fonts.displayBlack,
    fontSize: type.headingLarge,
    textTransform: 'uppercase',
    letterSpacing: -1,
    lineHeight: 34,
  },
  title: { fontFamily: fonts.display, fontSize: type.title, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.bodySemi, fontSize: type.subtitle },
  body: {},
  caption: { fontSize: type.caption, color: colors.muted },
  mono: { fontFamily: fonts.mono, fontSize: 13 },
  eyebrow: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.muted },
  state: { fontFamily: fonts.monoMedium, fontSize: 12, letterSpacing: 1, color: colors.brandDark },
});
