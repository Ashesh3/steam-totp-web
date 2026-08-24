import {
  generateSteamCode,
  normalizeSecret,
  isValidBase32,
  PERIOD,
} from './steam-totp.js';
import {
  loadTokens,
  addToken,
  updateToken,
  deleteToken,
  migrateLegacy,
} from './tokens.js';

const THEME_KEY = 'steam_totp_theme';
const ACTIVE_TOKEN_KEY = 'steam_totp_active_token';

const secretInput = document.getElementById('secret-input');
const nameInput = document.getElementById('name-input');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const formError = document.getElementById('form-error');
const toggleVisibilityBtn = document.getElementById('toggle-visibility');
const iconEye = toggleVisibilityBtn.querySelector('.icon-eye');
const iconEyeOff = toggleVisibilityBtn.querySelector('.icon-eye-off');
const codePlaceholder = document.getElementById('code-placeholder');
const codeDisplay = document.getElementById('code-display');
const totpCodeEl = document.getElementById('totp-code');
const progressBar = document.getElementById('progress-bar');
const countdownEl = document.getElementById('countdown');
const copyBtn = document.getElementById('copy-btn');
const copyLabel = document.getElementById('copy-label');
const themeToggle = document.getElementById('theme-toggle');
const tokensSection = document.getElementById('tokens-section');
const tokensList = document.getElementById('tokens-list');

let activeTokenId = null;
let currentCode = '';
let currentSlot = -1; // 30-second slot of currentCode
let animFrameId = null;
let pendingCodeReq = 0;

function invalidateCode() {
  pendingCodeReq++;
  currentCode = '';
  currentSlot = -1;
}

// ─── Theme ───────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}
const savedTheme = localStorage.getItem(THEME_KEY);
applyTheme(
  savedTheme ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
);
themeToggle.addEventListener('click', () => {
  applyTheme(
    document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light',
  );
});

// ─── Visibility Toggle ───────────────────────────────────────────────────────
toggleVisibilityBtn.addEventListener('click', () => {
  const isPassword = secretInput.type === 'password';
  secretInput.type = isPassword ? 'text' : 'password';
  iconEye.style.display = isPassword ? 'none' : '';
  iconEyeOff.style.display = isPassword ? '' : 'none';
});

// ─── Form Helpers ────────────────────────────────────────────────────────────
function showError(msg) {
  formError.textContent = msg || '';
  formError.classList.toggle('visible', Boolean(msg));
}

function clearForm() {
  invalidateCode();
  secretInput.value = '';
  nameInput.value = '';
  activeTokenId = null;
  localStorage.removeItem(ACTIVE_TOKEN_KEY);
  saveBtn.textContent = 'Save Token';
  showError('');
  renderTokens();
}

function setActiveToken(token) {
  invalidateCode();
  activeTokenId = token.id;
  localStorage.setItem(ACTIVE_TOKEN_KEY, token.id);
  secretInput.value = token.secret;
  nameInput.value = token.name;
  saveBtn.textContent = 'Update Token';
  showError('');
  renderTokens();
}

// ─── Code Generation ─────────────────────────────────────────────────────────
function currentSlotNumber() {
  return Math.floor(Date.now() / 1000 / PERIOD);
}

async function refreshCode() {
  const raw = secretInput.value;
  const normalized = normalizeSecret(raw);
  if (!normalized || !isValidBase32(normalized)) {
    currentCode = '';
    currentSlot = -1;
    return;
  }
  const slot = currentSlotNumber();
  if (slot === currentSlot && currentCode) return;
  const reqId = ++pendingCodeReq;
  try {
    const code = await generateSteamCode(normalized, slot * PERIOD);
    if (reqId !== pendingCodeReq) return; // superseded
    currentCode = code;
    currentSlot = slot;
  } catch {
    currentCode = '';
    currentSlot = -1;
  }
}

// ─── UI Loop ─────────────────────────────────────────────────────────────────
function getSecondsRemaining() {
  const now = Math.floor(Date.now() / 1000);
  return PERIOD - (now % PERIOD);
}

async function tick() {
  await refreshCode();

  if (!currentCode) {
    codePlaceholder.style.display = '';
    codeDisplay.style.display = 'none';
    totpCodeEl.textContent = '— — — — —';
    animFrameId = requestAnimationFrame(tick);
    return;
  }

  codePlaceholder.style.display = 'none';
  codeDisplay.style.display = '';

  if (totpCodeEl.textContent !== currentCode) {
    totpCodeEl.classList.add('refresh');
    totpCodeEl.textContent = currentCode;
    setTimeout(() => totpCodeEl.classList.remove('refresh'), 400);
  }

  const secondsLeft = getSecondsRemaining();
  const fraction = secondsLeft / PERIOD;
  progressBar.style.width = `${fraction * 100}%`;
  progressBar.classList.toggle('urgent', fraction <= 0.2);
  countdownEl.textContent = `${secondsLeft}s`;

  animFrameId = requestAnimationFrame(tick);
}

function startLoop() {
  cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(tick);
}

// ─── Input Handling ──────────────────────────────────────────────────────────
secretInput.addEventListener('input', () => {
  invalidateCode();
  // Editing the value detaches from any saved token until re-saved.
  if (activeTokenId) {
    activeTokenId = null;
    localStorage.removeItem(ACTIVE_TOKEN_KEY);
    saveBtn.textContent = 'Save Token';
    renderTokens();
  }
  showError('');
});

nameInput.addEventListener('input', () => showError(''));

// ─── Save / Delete / Select ──────────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  const normalized = normalizeSecret(secretInput.value);
  if (!normalized) {
    showError('Enter a Steam Value first.');
    return;
  }
  if (!isValidBase32(normalized)) {
    showError('That doesn’t look like a valid Steam Value (Base32).');
    return;
  }
  const name = nameInput.value.trim() || 'Untitled';

  try {
    if (activeTokenId) {
      const updated = updateToken(activeTokenId, { name, secret: normalized });
      if (updated) {
        // Reflect any normalization back into the input.
        secretInput.value = updated.secret;
        nameInput.value = updated.name;
      }
    } else {
      const created = addToken(name, normalized);
      activeTokenId = created.id;
      localStorage.setItem(ACTIVE_TOKEN_KEY, created.id);
      secretInput.value = created.secret;
      nameInput.value = created.name;
      saveBtn.textContent = 'Update Token';
    }
    showError('');
    renderTokens();
  } catch (err) {
    showError(err.message || 'Could not save token.');
  }
});

clearBtn.addEventListener('click', clearForm);

// ─── Token List Rendering ────────────────────────────────────────────────────
function renderTokens() {
  const tokens = loadTokens();
  tokensList.innerHTML = '';
  if (tokens.length === 0) {
    tokensSection.hidden = true;
    return;
  }
  tokensSection.hidden = false;

  for (const t of tokens) {
    const li = document.createElement('li');
    li.className = 'token-item' + (t.id === activeTokenId ? ' active' : '');
    li.dataset.id = t.id;

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'token-main';
    main.title = 'Load this token';
    main.innerHTML = `
      <span class="token-name"></span>
      <span class="token-meta">${t.id === activeTokenId ? 'Active' : 'Tap to load'}</span>
    `;
    main.querySelector('.token-name').textContent = t.name;
    main.addEventListener('click', () => setActiveToken(t));

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'token-delete';
    del.setAttribute('aria-label', `Delete ${t.name}`);
    del.title = 'Delete token';
    del.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6"/>
        <path d="M14 11v6"/>
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
      </svg>
    `;
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm(`Delete token "${t.name}"?`)) return;
      deleteToken(t.id);
      if (activeTokenId === t.id) clearForm();
      else renderTokens();
    });

    li.append(main, del);
    tokensList.append(li);
  }
}

// ─── Clipboard ───────────────────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  if (!currentCode) return;
  try {
    await navigator.clipboard.writeText(currentCode);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = currentCode;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  copyLabel.textContent = 'Copied!';
  copyBtn.classList.add('copied');
  setTimeout(() => {
    copyLabel.textContent = 'Copy Code';
    copyBtn.classList.remove('copied');
  }, 2000);
});

// ─── Boot ────────────────────────────────────────────────────────────────────
const migrated = migrateLegacy();

const lastActive = localStorage.getItem(ACTIVE_TOKEN_KEY);
const tokens = loadTokens();
if (lastActive) {
  const found = tokens.find((t) => t.id === lastActive);
  if (found) {
    setActiveToken(found);
  } else {
    localStorage.removeItem(ACTIVE_TOKEN_KEY);
    if (migrated) setActiveToken(migrated);
  }
} else if (migrated) {
  setActiveToken(migrated);
}
renderTokens();
startLoop();
