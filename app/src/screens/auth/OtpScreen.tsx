import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { OtpInput } from '../../components/OtpInput';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AuthStackParams } from '../../navigation/types';
import { OTP_LENGTH } from '../../services/backend/auth';
import { ERROR_COPY, toApiError } from '../../services/backend/errors';
import { useAuth } from '../../store/auth';
import { colors, space } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParams, 'Otp'>;

const WORDS: Record<number, string> = { 6: 'Six digits', 7: 'Seven digits', 8: 'Eight digits' };
const RESEND_AFTER = 60; // Supabase allows one email per address per minute

export function OtpScreen({ navigation }: Props) {
  const email = useAuth((s) => s.pendingEmail) ?? '';
  const verifyCode = useAuth((s) => s.verifyCode);
  const sendCode = useAuth((s) => s.sendCode);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_AFTER);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      // on success the root navigator swaps to Role / the app once the user exists
      const next = await verifyCode(code);
      if (next === 'needs_profile') navigation.replace('Register', { email });
    } catch (e) {
      setError(ERROR_COPY[toApiError(e).code]);
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(undefined);
    setWait(RESEND_AFTER);
    try {
      await sendCode(email);
    } catch (e) {
      setError(ERROR_COPY[toApiError(e).code]);
    }
  };

  useEffect(() => {
    if (code.length === OTP_LENGTH && !busy) void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const mins = Math.floor(wait / 60);
  const secs = String(wait % 60).padStart(2, '0');

  return (
    <Screen scroll>
      <View style={s.header}>
        <Logo variant="mark" height={30} />
      </View>
      <T kind="h1">{WORDS[OTP_LENGTH] ?? `${OTP_LENGTH} digits`}</T>
      <T kind="caption">
        Sent to <T kind="mono" style={{ color: colors.ink }}>{email}</T>.
      </T>
      <View style={s.form}>
        <OtpInput value={code} onChange={setCode} length={OTP_LENGTH} error={!!error} />
        {!!error && (
          <T kind="caption" style={s.error}>
            {error}
          </T>
        )}
        <Button title="Verify" onPress={submit} loading={busy} disabled={code.length < OTP_LENGTH} />
        <Button
          title={wait > 0 ? `Send a new code (${mins}:${secs})` : 'Send a new code'}
          variant="ghost"
          onPress={resend}
          disabled={wait > 0 || busy}
        />
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
