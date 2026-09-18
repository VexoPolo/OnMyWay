import { Archivo_800ExtraBold, Archivo_900Black } from '@expo-google-fonts/archivo';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Logo } from './src/components/Logo';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SplashScreen } from './src/screens/SplashScreen';
import { colors } from './src/theme';

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [ready] = useFonts({
    Archivo_800ExtraBold,
    Archivo_900Black,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {ready ? (
        <>
          <RootNavigator />
          {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
        </>
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center' }}>
          <Logo variant="full" height={120} />
        </View>
      )}
    </SafeAreaProvider>
  );
}
