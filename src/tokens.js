// LocalStorage-backed token store. Secrets never leave the device.
import { normalizeSecret, isValidBase32 } from './steam-totp.js';

const TOKENS_KEY = 'steam_totp_tokens_v1';
const LEGACY_SECRET_KEY = 'steam_totp_secret';

function makeId() {
  return 't_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function loadTokens() {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (t) => t && typeof t.id === 'string' && typeof t.secret === 'string',
    );
  } catch {
    return [];
  }
}

function persist(tokens) {
  // intentional: user-consented local-only storage, never transmitted
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

// Pull any pre-v1 single-secret value into the new list, then remove it.
export function migrateLegacy() {
  const legacy = localStorage.getItem(LEGACY_SECRET_KEY);
  if (!legacy) return null;
  const normalized = normalizeSecret(legacy);
  localStorage.removeItem(LEGACY_SECRET_KEY);
  if (!normalized || !isValidBase32(normalized)) return null;
  const tokens = loadTokens();
  if (tokens.some((t) => t.secret === normalized)) return null;
  const token = { id: makeId(), name: 'My Steam Account', secret: normalized };
  tokens.push(token);
  persist(tokens);
  return token;
}

export function addToken(name, rawSecret) {
  const secret = normalizeSecret(rawSecret);
  if (!isValidBase32(secret)) {
    throw new Error('Invalid Steam Value');
  }
  const tokens = loadTokens();
  const token = {
    id: makeId(),
    name: (name || '').trim() || 'Untitled',
    secret,
  };
  tokens.push(token);
  persist(tokens);
  return token;
}

export function updateToken(id, updates) {
  const tokens = loadTokens();
  const idx = tokens.findIndex((t) => t.id === id);
  if (idx < 0) return null;
  const next = { ...tokens[idx] };
  if (updates.name !== undefined) {
    next.name = (updates.name || '').trim() || 'Untitled';
  }
  if (updates.secret !== undefined) {
    const secret = normalizeSecret(updates.secret);
    if (!isValidBase32(secret)) throw new Error('Invalid Steam Value');
    next.secret = secret;
  }
  tokens[idx] = next;
  persist(tokens);
  return next;
}

export function deleteToken(id) {
  const tokens = loadTokens().filter((t) => t.id !== id);
  persist(tokens);
}

export function getToken(id) {
  return loadTokens().find((t) => t.id === id) || null;
}
