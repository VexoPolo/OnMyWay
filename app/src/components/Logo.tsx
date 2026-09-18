import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme';

const mark = require('../../assets/logo/onmyway-mark.png');
const full = require('../../assets/logo/onmyway-logo.png');

/** The OnMyWay logo. `lockup` = mark + wordmark inline; `full` = the stacked logo; `mark` = pin+MW only. */
export function Logo({ variant = 'lockup', height = 34 }: { variant?: 'lockup' | 'full' | 'mark'; height?: number }) {
  if (variant === 'full') {
    // full lockup is 556×371
    return <Image source={full} style={{ height, width: height * (556 / 371) }} contentFit="contain" />;
  }
  const markW = height * (532 / 221);
  return (
    <View style={s.row}>
      <Image source={mark} style={{ height, width: markW }} contentFit="contain" />
      {variant === 'lockup' && <Text style={[s.word, { fontSize: height * 0.62 }]}>OnMyWay</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  word: { fontFamily: fonts.display, color: colors.brandDark, letterSpacing: -0.5 },
});
