import steamtotp from 'steam-totp';

// ─── Constants ───────────────────────────────────────────────────────────────
const STORAGE_KEY = 'steam_totp_secret';
const THEME_KEY = 'steam_totp_theme';
const PERIOD = 30; // Steam TOTP period in seconds

// ─── DOM References ──────────────────────────────────────────────────────────
const secretInput = document.getElementById('secret-input');
const saveCheckbox = document.getElementById('save-secret');
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

// ─── State ───────────────────────────────────────────────────────────────────
let animFrameId = null;
let currentCode = '';

// ─── Theme ───────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'light' ? 'dark' : 'light');
}

const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme) {
  applyTheme(savedTheme);
} else {
  applyTheme(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
}

themeToggle.addEventListener('click', toggleTheme);

// ─── Visibility Toggle ───────────────────────────────────────────────────────
toggleVisibilityBtn.addEventListener('click', () => {
  const isPassword = secretInput.type === 'password';
  secretInput.type = isPassword ? 'text' : 'password';
  iconEye.style.display = isPassword ? 'none' : '';
  iconEyeOff.style.display = isPassword ? '' : 'none';
});

// ─── TOTP Core ───────────────────────────────────────────────────────────────
function getSecondsRemaining() {
  const now = Math.floor(Date.now() / 1000);
  return PERIOD - (now % PERIOD);
}

function tryGenerateCode(secret) {
  if (!secret || !secret.trim()) return null;
  try {
    return steamtotp.generateAuthCode(secret.trim());
  } catch {
    return null;
  }
}

// ─── UI Update Loop ──────────────────────────────────────────────────────────
function updateUI() {
  const secret = secretInput.value;
  const code = tryGenerateCode(secret);

  if (!code) {
    // No valid code — show placeholder, hide display
    codePlaceholder.style.display = '';
    codeDisplay.style.display = 'none';
    cancelAnimationFrame(animFrameId);
    animFrameId = requestAnimationFrame(updateUI);
    return;
  }

  // Code is valid — show display, hide placeholder
  codePlaceholder.style.display = 'none';
  codeDisplay.style.display = '';

  // Refresh code and animate if changed
  if (code !== currentCode) {
    currentCode = code;
    totpCodeEl.classList.add('refresh');
    totpCodeEl.textContent = code;
    setTimeout(() => totpCodeEl.classList.remove('refresh'), 400);
  }

  // Update progress bar and countdown
  const secondsLeft = getSecondsRemaining();
  const fraction = secondsLeft / PERIOD;
  progressBar.style.width = `${fraction * 100}%`;

  // Color shifts as time runs out
  if (fraction <= 0.2) {
    progressBar.classList.add('urgent');
  } else {
    progressBar.classList.remove('urgent');
  }

  countdownEl.textContent = `${secondsLeft}s`;

  animFrameId = requestAnimationFrame(updateUI);
}

function startLoop() {
  cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(updateUI);
}

// ─── Input Handling ──────────────────────────────────────────────────────────
secretInput.addEventListener('input', () => {
  const secret = secretInput.value.trim();

  // Only persist when the user has explicitly opted in via the checkbox.
  // Storage is scoped to this origin (localStorage) and never transmitted
  // to any server — the secret stays on the user's device.
  if (saveCheckbox.checked) {
    if (secret) {
      localStorage.setItem(STORAGE_KEY, secret); // intentional: user-consented local-only storage
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
});

// ─── Save / Restore ──────────────────────────────────────────────────────────
saveCheckbox.addEventListener('change', () => {
  if (saveCheckbox.checked) {
    const secret = secretInput.value.trim();
    // intentional: user-consented local-only storage, never leaves the device
    if (secret) localStorage.setItem(STORAGE_KEY, secret);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
});

const savedSecret = localStorage.getItem(STORAGE_KEY);
if (savedSecret) {
  secretInput.value = savedSecret;
  saveCheckbox.checked = true;
}

// ─── Copy to Clipboard ───────────────────────────────────────────────────────
copyBtn.addEventListener('click', async () => {
  if (!currentCode) return;
  try {
    await navigator.clipboard.writeText(currentCode);
    copyLabel.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyLabel.textContent = 'Copy Code';
      copyBtn.classList.remove('copied');
    }, 2000);
  } catch {
    // Fallback for browsers that block clipboard API
    const ta = document.createElement('textarea');
    ta.value = currentCode;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    copyLabel.textContent = 'Copied!';
    setTimeout(() => (copyLabel.textContent = 'Copy Code'), 2000);
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────
startLoop();
