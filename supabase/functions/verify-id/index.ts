// OnMyWay · verify-id · checks the caller's own ID-card photo by its barcode.
// Plain code only: decode the card's barcode and compare it with the reg number on the profile.
// No AI model, no API key. Deploy with "Verify JWT" ON.
// Never logs the image, the name, the reg number or the barcode: only status and reason codes.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { prepareZXingModule, readBarcodes } from 'npm:zxing-wasm@3.1.5/reader';

// The barcode reader (ZXing-C++ as WebAssembly), pinned to one file and checked before use.
// Only this public library file is fetched; the photo never leaves the project.
const WASM_URL = 'https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.5/dist/reader/zxing_reader.wasm';
const WASM_SHA256 = 'aecc1876de036c62c8419f67a5e1a16b1698a325bcd190aa84810d516e263931';
const IMAGE_TYPES = ['image/jpeg', 'image/png']; // what the reader decodes; WebP and HEIC aren't
const MAX_BYTES = 5_242_880; // the bucket's own limit
const REG_RE = /[0-9]{2}[A-Z]{3}[0-9]{4}/g; // same shape as profiles.reg_no

type Status = 'approved' | 'review' | 'rejected';
type Decision = [Status, string];
type Start = { go: boolean; why?: string; status?: string; check?: number; uploaded_at?: string; reg_no?: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

let reader: Promise<void> | null = null;
function loadReader(): Promise<void> {
  reader ??= (async () => {
    const res = await fetch(WASM_URL);
    if (!res.ok) throw new Error('wasm_fetch');
    const bytes = await res.arrayBuffer();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
    if (hash !== WASM_SHA256) throw new Error('wasm_hash');
    await prepareZXingModule({ overrides: { wasmBinary: bytes }, fireImmediately: true });
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

  // Only ever this student's own file: id-cards/<uid>.
  const { data: photo } = await service.storage.from('id-cards').download(uid);
  if (!photo) return json({ status: 'none' });

  const { data: start, error } = await service.rpc('id_check_begin', { p_user: uid });
  if (error || !start) {
    console.error('verify-id begin', error?.code ?? 'empty');
    return json({ error: 'unavailable' }, 503);
  }
  const s = start as Start;
  if (!s.go) {
    if (s.why === 'too_many_attempts' || s.why === 'daily_cap') return json(await finish(service, uid, s, ['review', s.why]));
    return json({ status: s.status ?? 'none' });
  }
  return json(await finish(service, uid, s, await decide(service, uid, s, photo)));
});

async function decide(service: SupabaseClient, uid: string, s: Start, photo: Blob): Promise<Decision> {
  const typed = normReg(s.reg_no ?? '');
  const found = await barcodeRegs(photo);
  if (!found) return ['review', 'barcode_unreadable'];

  if (found.includes(typed)) {
    const { data } = await service.from('app_config').select('value').eq('key', 'id_auto_approve_on_barcode').maybeSingle();
    return data?.value === true || data?.value === 'true' ? ['approved', 'barcode_match'] : ['review', 'barcode_match'];
  }
  // The barcode holds a different reg number: someone else's account, or simply not this student.
  for (const reg of found) {
    const { data: taken, error } = await service.rpc('id_reg_used_by_other', { p_user: uid, p_reg: reg });
    if (error) return ['review', 'barcode_unreadable'];
    if (taken) return ['rejected', 'reg_no_in_use'];
  }
  return ['rejected', 'reg_mismatch'];
}

/** Reg-number-shaped values from the photo's barcodes. null = nothing usable (never a rejection). */
async function barcodeRegs(photo: Blob): Promise<string[] | null> {
  if (!IMAGE_TYPES.includes(photo.type) || photo.size > MAX_BYTES) return null;
  try {
    await loadReader();
    const results = await readBarcodes(photo, { tryHarder: true, maxNumberOfSymbols: 4 });
    const regs = new Set<string>();
    for (const r of results) {
      if (!r.isValid) continue;
      for (const m of normReg(r.text).matchAll(REG_RE)) regs.add(m[0]);
    }
    return regs.size ? [...regs] : null;
  } catch (e) {
    console.error('verify-id barcode', e instanceof Error ? e.message.slice(0, 40) : 'error');
    return null;
  }
}

/** Upper case, no spaces or separators: "21 bce-1234" -> "21BCE1234". */
const normReg = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

async function finish(service: SupabaseClient, uid: string, s: Start, [status, reason]: Decision) {
  const { data: next, error } = await service.rpc('id_check_finish', {
    p_user: uid,
    p_check: s.check ?? null,
    p_uploaded_at: s.uploaded_at ?? null,
    p_status: status,
    p_reason: reason,
  });
  if (error) {
    console.error('verify-id finish', error.code);
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
