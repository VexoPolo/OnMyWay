import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { OtpInput } from '../../components/OtpInput';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AuthStackParams } from '../../navigation/types';
import { api } from '../../services/mock';
import { useAuth } from '../../store/auth';
import { colors, space } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParams, 'Otp'>;

export function OtpScreen({ navigation }: Props) {
  const regNo = useAuth((s) => s.pendingRegNo) ?? '';
  const verifyOtp = useAuth((s) => s.verifyOtp);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    const res = await api.verifyOtp(regNo, code);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    verifyOtp(res.token, res.name); // root navigator swaps to Role once user exists
  };

  useEffect(() => {
    if (code.length === 6 && !busy) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <Screen scroll>
      <View style={s.header}>
        <Logo variant="mark" height={30} />
      </View>
      <T kind="h1">Six digits</T>
      <T kind="caption">
        Sent to the number on file for <T kind="mono" style={{ color: colors.ink }}>{regNo}</T>.
      </T>
      <View style={s.form}>
        <OtpInput value={code} onChange={setCode} error={!!error} />
        {!!error && (
          <T kind="caption" style={s.error}>
            {error}
          </T>
        )}
        <Button title="Verify" onPress={submit} loading={busy} disabled={code.length < 6} />
        <Button title="Back" variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: space.xl },
  form: { gap: space.md, marginTop: space.md },
  error: { color: colors.error, textAlign: 'center' },
});
