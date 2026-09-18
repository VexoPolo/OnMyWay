import { Platform, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { T } from './Text';

// VIT Vellore, roughly. The demo campus.
export const CAMPUS = { latitude: 12.9692, longitude: 79.1559 };

const COORDS: Record<string, { latitude: number; longitude: number }> = {
  'Main Gate': { latitude: 12.9716, longitude: 79.1594 },
  'Block A': { latitude: 12.9702, longitude: 79.1571 },
  'Block B': { latitude: 12.9695, longitude: 79.1562 },
  'Block C': { latitude: 12.9688, longitude: 79.1553 },
  Library: { latitude: 12.9698, longitude: 79.1548 },
  'Mens Hostel': { latitude: 12.9672, longitude: 79.1540 },
  'Ladies Hostel': { latitude: 12.9684, longitude: 79.1530 },
  'Food Court': { latitude: 12.9690, longitude: 79.1580 },
  'Sports Complex': { latitude: 12.9665, longitude: 79.1575 },
};

interface Props {
  pickup: string;
  dropoff: string;
  /** 0..1 — where the courier is along the route */
  progress: number;
}

/** Live map. On web (no react-native-maps) it degrades to a schematic. */
export function LiveMap({ pickup, dropoff, progress }: Props) {
  const a = COORDS[pickup] ?? CAMPUS;
  const b = COORDS[dropoff] ?? CAMPUS;
  const courier = {
    latitude: a.latitude + (b.latitude - a.latitude) * progress,
    longitude: a.longitude + (b.longitude - a.longitude) * progress,
  };

  if (Platform.OS === 'web') {
    return (
      <View style={s.schematic}>
        <View style={[s.pin, { backgroundColor: colors.pinPickup, left: '15%', top: '30%' }]} />
        <View style={[s.pin, { backgroundColor: colors.pinDrop, left: '80%', top: '65%' }]} />
        <View style={[s.puck, { left: `${15 + 65 * progress}%`, top: `${30 + 35 * progress}%` }]} />
        <T kind="caption" style={s.webNote}>
          Map renders on device
        </T>
      </View>
    );
  }

  // Required lazily so the web bundle never touches native-only modules.
  const Maps = require('react-native-maps');
  const MapView = Maps.default;
  const { Marker, Polyline } = Maps;
  return (
    <MapView
      style={s.map}
      initialRegion={{ ...CAMPUS, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
      customMapStyle={DARK}
      userInterfaceStyle="dark"
      showsUserLocation={false}
    >
      <Polyline coordinates={[a, b]} strokeColor={colors.brandB} strokeWidth={4} />
      <Marker coordinate={a} pinColor={colors.pinPickup} title={pickup} />
      <Marker coordinate={b} pinColor={colors.pinDrop} title={dropoff} />
      <Marker coordinate={courier} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={s.puckMarker} />
      </Marker>
    </MapView>
  );
}

const DARK = [
  { elementType: 'geometry', stylers: [{ color: '#171717' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#737373' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0A0A0A' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#232326' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0A0A0A' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
];

const s = StyleSheet.create({
  map: { flex: 1 },
  schematic: { flex: 1, backgroundColor: colors.surface },
  pin: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  puck: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: colors.brandA, marginLeft: -2, marginTop: -2 },
  puckMarker: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.brandA, borderWidth: 3, borderColor: colors.ground },
  webNote: { position: 'absolute', bottom: 8, right: 12 },
});
