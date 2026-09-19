import { View } from 'react-native';
import { colors } from '../theme';

/**
 * Brand glyphs drawn with plain Views — the logo's own vocabulary, no icon font.
 * `size` is the bounding box; `color` defaults to the on-yellow ink.
 */
type G = { size?: number; color?: string };

/** The pin from the logo mark: a ring with a point underneath. */
export function PinGlyph({ size = 24, color = colors.onBrand }: G) {
  const d = size * 0.62; // ring diameter
  const ring = size * 0.2;
  const tail = size * 0.34;
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View style={{ width: d, height: d, borderRadius: d / 2, borderWidth: ring, borderColor: color, marginTop: size * 0.04 }} />
      <View
        style={{
          position: 'absolute',
          top: size * 0.44,
          width: tail,
          height: tail,
          backgroundColor: color,
          borderRadius: size * 0.06,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

/** Walking courier carrying a parcel. */
export function WalkerGlyph({ size = 24, color = colors.onBrand }: G) {
  const k = size / 24;
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View style={{ width: 6 * k, height: 6 * k, borderRadius: 3 * k, backgroundColor: color }} />
      <View style={{ width: 2.2 * k, height: 8 * k, backgroundColor: color, borderRadius: k }} />
      <View style={{ position: 'absolute', top: 8 * k, right: 1 * k, width: 6 * k, height: 5 * k, borderRadius: k, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: 13 * k, width: 2.2 * k, height: 10 * k, borderRadius: k, backgroundColor: color, transform: [{ rotate: '-24deg' }, { translateY: 3 * k }] }} />
      <View style={{ position: 'absolute', top: 13 * k, width: 2.2 * k, height: 10 * k, borderRadius: k, backgroundColor: color, transform: [{ rotate: '24deg' }, { translateY: 3 * k }] }} />
    </View>
  );
}

/** Taped parcel: box outline with a tape line. */
export function ParcelGlyph({ size = 24, color = colors.onBrand }: G) {
  const k = size / 24;
  return (
    <View style={{ width: 20 * k, height: 18 * k, borderWidth: 2.2 * k, borderColor: color, borderRadius: 3 * k, justifyContent: 'center' }}>
      <View style={{ position: 'absolute', top: 3 * k, left: 0, right: 0, height: 2.2 * k, backgroundColor: color }} />
      <View style={{ position: 'absolute', top: 3 * k, left: 6 * k, width: 2.2 * k, bottom: 0, backgroundColor: color }} />
    </View>
  );
}
