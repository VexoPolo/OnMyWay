// OnMyWay · verify-id · checks the caller's own ID-card photo by its barcode.
// Plain code only: decode the card's barcode and compare it with the reg number on the profile.
// No AI model, no API key, nothing fetched at runtime. Deploy with "Verify JWT" ON.
// Never logs the image, the name, the reg number or the barcode: only status and reason codes.
//
// Once id_check_begin says go, every path ends in id_check_finish: a result, or 'review' with
// check_failed / barcode_unreadable. If the runtime itself kills the request (CPU or memory
// limit), migration 0015 moves the student from pending to review after an hour.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { decodeBase64 } from 'jsr:@std/encoding@1/base64';
import { prepareZXingModule, readBarcodes } from 'npm:zxing-wasm@3.1.5/reader';
import { ZXING_READER_WASM_BASE64 } from './zxing_reader_wasm.ts';

const WASM_SHA256 = 'aecc1876de036c62c8419f67a5e1a16b1698a325bcd190aa84810d516e263931';
const MAX_BYTES = 5_242_880; // the bucket's own limit
const MAX_SIDE = 2400; // px. The app sends at most 1600; bigger images could hit the 2 s CPU limit
const DECODE_TIMEOUT_MS = 10_000; // wall clock; the CPU limit itself can't be caught from code
const REG_RE = /[0-9]{2}[A-Z]{3}[0-9]{4}/g; // same shape as profiles.reg_no

type Status = 'approved' | 'review' | 'rejected';
type Decision = [Status, string];
type Start = { go: boolean; why?: string; status?: string; check?: number; uploaded_at?: string; reg_no?: string };

class Unreadable extends Error {} // the image can't be read: barcode_unreadable, not a failure

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let reader: Promise<void> | null = null;
function loadReader(): Promise<void> {
  reader ??= (async () => {
    const bytes = decodeBase64(ZXING_READER_WASM_BASE64);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const hash = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
    if (hash !== WASM_SHA256) throw new Error('wasm_hash');
    await prepareZXingModule({ overrides: { wasmBinary: bytes.buffer as ArrayBuffer }, fireImmediately: true });
  })().catch((e) => {
    reader = null; // try again on the next request
    throw e;
  });
  return reader;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Who is asking comes from the verified JWT only, never from the request body.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: who } = await service.auth.getUser(token);
  const uid = who.user?.id;
  if (!uid) return json({ error: 'not_signed_in' }, 401);

  // Only ever this student's own file: id-cards/<uid>. No file at all: nothing to check.
  const { data: photo } = await service.storage.from('id-cards').download(uid);
  if (!photo) {
    const { data: exists, error } = await service.storage.from('id-cards').exists(uid);
    if (!error && !exists) return json({ status: 'none' });
    // the file is there but couldn't be fetched: still record a check, ending in review
  }

  const { data: start, error } = await service.rpc('id_check_begin', { p_user: uid });
  if (error || !start) {
    console.error('verify-id begin', error?.code ?? 'empty');
    return json({ error: 'unavailable' }, 503);
  }
  const s = start as Start;
  if (!s.go) {
    // over a limit: a person looks instead (review gets a delete time, 14 days)
    if (s.why === 'too_many_attempts' || s.why === 'daily_cap') return json(await finish(service, uid, s, ['review', s.why]));
    return json({ status: s.status ?? 'none' }); // already decided, or no profile
  }

  let decision: Decision;
  try {
    decision = photo ? await decide(service, uid, s, photo) : ['review', 'check_failed'];
  } catch (e) {
    console.error('verify-id failed', e instanceof Error ? e.message.slice(0, 40) : 'error');
    decision = ['review', 'check_failed'];
  }
  return json(await finish(service, uid, s, decision));
});

// ---- decision ----------------------------------------------------------------------------------
// match            -> review barcode_match (approved when id_auto_approve_on_barcode is true)
// other's number   -> rejected reg_no_in_use (photo kept up to 14 days)
// different number -> rejected reg_mismatch
// nothing readable -> review barcode_unreadable (never rejected)
// any error        -> review check_failed (thrown, caught by the caller)
async function decide(service: SupabaseClient, uid: string, s: Start, photo: Blob): Promise<Decision> {
  const typed = normReg(s.reg_no ?? '');
  let found: string[];
  try {
    found = await barcodeRegs(photo);
  } catch (e) {
    if (e instanceof Unreadable) return ['review', 'barcode_unreadable'];
    throw e;
  }
  if (!found.length) return ['review', 'barcode_unreadable'];

  if (found.includes(typed)) {
    const { data, error } = await service.from('app_config').select('value').eq('key', 'id_auto_approve_on_barcode').maybeSingle();
    if (error) throw new Error('config');
    return data?.value === true || data?.value === 'true' ? ['approved', 'barcode_match'] : ['review', 'barcode_match'];
  }
  // The barcode holds a different reg number: someone else's account, or simply not this student.
  for (const reg of found) {
    const { data: taken, error } = await service.rpc('id_reg_used_by_other', { p_user: uid, p_reg: reg });
    if (error) throw new Error('reg_lookup');
    if (taken) return ['rejected', 'reg_no_in_use'];
  }
  return ['rejected', 'reg_mismatch'];
}

/** Reg-number-shaped values from the photo's barcodes. Throws Unreadable for images it can't take. */
async function barcodeRegs(photo: Blob): Promise<string[]> {
  if (photo.size > MAX_BYTES) throw new Unreadable('too_big');
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const size = imageSize(bytes); // JPEG or PNG only: what the reader decodes (not WebP or HEIC)
  if (!size) throw new Unreadable('format');
  if (Math.max(size.width, size.height) > MAX_SIDE) throw new Unreadable('too_large'); // CPU guard

  await loadReader(); // a failure here throws: check_failed
  const results = await withTimeout(readBarcodes(bytes, { tryHarder: true, maxNumberOfSymbols: 4 }), DECODE_TIMEOUT_MS);
  const regs = new Set<string>();
  for (const r of results) {
    if (!r.isValid) continue;
    for (const m of normReg(r.text).matchAll(REG_RE)) regs.add(m[0]);
  }
  return [...regs];
}

/** Width and height from a JPEG or PNG header, without decoding the image. null = neither. */
function imageSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const v = new DataView(b.buffer, b.byteOffset);
    return { width: v.getUint32(16), height: v.getUint32(20) };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) return null;
      const marker = b[i + 1];
      const len = (b[i + 2] << 8) | b[i + 3];
      // SOF0..SOF15, except DHT (C4), JPG (C8) and DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
      }
      i += 2 + len;
    }
  }
  return null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: number | undefined;
  return Promise.race([p, new Promise<never>((_, reject) => (t = setTimeout(() => reject(new Error('timeout')), ms)))]).finally(
    () => clearTimeout(t),
  );
}

/** Upper case, no spaces or separators: "21 bce-1234" -> "21BCE1234". */
const normReg = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

// ---- result ------------------------------------------------------------------------------------
async function finish(service: SupabaseClient, uid: string, s: Start, [status, reason]: Decision) {
  const args = { p_user: uid, p_check: s.check ?? null, p_uploaded_at: s.uploaded_at ?? null, p_status: status, p_reason: reason };
  let { data: next, error } = await service.rpc('id_check_finish', args);
  if (error) ({ data: next, error } = await service.rpc('id_check_finish', args)); // one retry
  if (error) {
    console.error('verify-id finish', error.code); // still pending: 0015 moves it to review after an hour
    return { status: 'pending' };
  }
  if (next === 'stale') return { status: 'pending' }; // a newer upload arrived; it gets its own check
  if (next === 'delete') {
    // through the Storage API; if this fails, purge-id-cards picks it up (its time is already due)
    const { error: rm } = await service.storage.from('id-cards').remove([uid]);
    if (rm) console.error('verify-id remove', rm.name);
    else await service.rpc('id_photos_deleted', { p_users: [uid] });
  }
  console.log('verify-id', status, reason);
  return { status, reason };
}
