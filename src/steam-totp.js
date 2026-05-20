// Browser-native Steam Guard code generator.
//
// Steam's 5-character codes are derived from a Base32-encoded shared secret
// (RFC 4648), HMAC-SHA1 over a 30-second counter, and a 26-character custom
// alphabet. Algorithm mirrors gizmo-ds/totp-wasm `steam_guard`.

export const STEAM_ALPHABET = '23456789BCDFGHJKMNPQRTVWXY';
export const PERIOD = 30;

const BASE32_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_RE = /^[A-Z2-7]+=*$/;

// Strip `steam://` prefix, whitespace, and hyphens; uppercase.
export function normalizeSecret(input) {
  if (input == null) return '';
  let s = String(input).trim();
  s = s.replace(/^steam:\/\//i, '');
  s = s.replace(/[\s-]+/g, '');
  return s.toUpperCase();
}

export function isValidBase32(secret) {
  if (!secret) return false;
  return BASE32_RE.test(secret);
}

export function base32Decode(secret) {
  if (!isValidBase32(secret)) {
    throw new Error('Invalid Base32 secret');
  }
  const clean = secret.replace(/=+$/, '');
  const out = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = BASE32_ALPHA.indexOf(ch);
    if (idx < 0) throw new Error('Invalid Base32 character');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

async function hmacSha1(keyBytes, dataBytes) {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, dataBytes);
  return new Uint8Array(sig);
}

function counterBytes(counter) {
  const buf = new ArrayBuffer(8);
  const dv = new DataView(buf);
  // JS bitwise ops are 32-bit; split into high/low to keep precision.
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  dv.setUint32(0, high, false);
  dv.setUint32(4, low, false);
  return new Uint8Array(buf);
}

// `timeSeconds` defaults to current Unix time.
export async function generateSteamCode(rawSecret, timeSeconds) {
  const secret = normalizeSecret(rawSecret);
  const keyBytes = base32Decode(secret);
  const t = Math.floor((timeSeconds ?? Date.now() / 1000) / PERIOD);

  const hash = await hmacSha1(keyBytes, counterBytes(t));
  const offset = hash[hash.length - 1] & 0xf;
  // 31-bit dynamic truncation
  let val =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  val = val >>> 0; // unsigned

  let code = '';
  for (let i = 0; i < 5; i++) {
    code += STEAM_ALPHABET[val % STEAM_ALPHABET.length];
    val = Math.floor(val / STEAM_ALPHABET.length);
  }
  return code;
}
