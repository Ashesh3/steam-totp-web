# Steam TOTP

<p align="center">
  <img width="640" height="819" alt="Steam TOTP screenshot" src="https://github.com/user-attachments/assets/aa370aa0-8b85-4e2e-863b-8d4e20240362" />
</p>

<p align="center">
  <strong>Offline-first Steam Guard 2FA code generator.</strong><br/>
  Your shared secret stays on your device — nothing is ever transmitted.
</p>

<p align="center">
  <a href="https://ashesh3.github.io/steam-totp-web/"><strong>→ Live demo</strong></a>
</p>

---

## Features

- **Steam Guard codes in your browser.** Generates the 5-character alphanumeric codes Steam uses (alphabet `23456789BCDFGHJKMNPQRTVWXY`).
- **Local-only.** Secrets are processed entirely in-browser with the Web Crypto API. No network calls, no analytics, no telemetry.
- **Flexible input.** Accepts a raw Steam Value, a lowercase secret, a `steam://...` URL, or a secret with spaces/hyphens — all normalized automatically.
- **Multiple named tokens.** Save, rename, switch, and delete tokens. Stored in `localStorage` only.
- **Migrates the old single-secret key** (`steam_totp_secret`) into the new token list automatically on first run.
- **Auto-refreshing UI.** 30-second progress bar, color shift in the last 6 seconds, one-click copy.
- **Dark / light theme** with system preference detection.
- **Tiny.** ~7.6 KB gzipped bundle, no runtime dependencies.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build to ./dist
npm run preview  # serve the production build
npm run verify   # check the algorithm against the reference vector
```

## How it works

Steam's TOTP variant follows RFC 6238 with a custom 26-character alphabet and a 30-second period:

1. The Steam Value is normalized (strip `steam://`, whitespace, hyphens; uppercase) and decoded as RFC 4648 Base32.
2. The Unix time is divided by 30 to produce an 8-byte big-endian counter.
3. HMAC-SHA1 (via `crypto.subtle`) is computed over the counter using the secret bytes as the key.
4. Dynamic truncation takes 4 bytes from the hash at offset `hash[last] & 0xf` and masks the top bit (`& 0x7FFFFFFF`).
5. The resulting integer is converted to 5 characters using `23456789BCDFGHJKMNPQRTVWXY`.

The implementation lives in [`src/steam-totp.js`](src/steam-totp.js) and mirrors [`gizmo-ds/totp-wasm`](https://github.com/gizmo-ds/totp-wasm)'s `steam_guard`.

### Reference vector

| Secret | Time | Expected code |
|---|---|---|
| `GM4VC2CQN5UGS33ZJJVWYUSFMQ4HOQJW` | `1662681600` | `4PRPM` |

`npm run verify` asserts this — and a few normalization variants — against the implementation.

## Privacy & storage

- Secrets are **never** sent anywhere. Codes are generated entirely client-side.
- The app uses `localStorage` for:
  - `steam_totp_tokens_v1` — your saved tokens (`{ id, name, secret }`), Base32 only.
  - `steam_totp_active_token` — the id of the most recently selected token.
  - `steam_totp_theme` — your light/dark preference.
- Nothing leaves your browser. There is no backend.

To delete everything the app has stored, clear site data for the origin in your browser's devtools.

## Project layout

```
├── index.html                       # App shell
├── src/
│   ├── main.js                      # UI wiring, token list, code loop
│   ├── steam-totp.js                # Browser-native Steam Guard generator
│   ├── tokens.js                    # localStorage-backed token store + legacy migration
│   └── style.css                    # Styles, theming
├── scripts/
│   └── verify-steam-totp.js         # `npm run verify` — checks the reference vector
├── vite.config.js
└── .github/workflows/deploy.yml     # Builds and deploys to GitHub Pages on push to master
```

## Deployment

Every push to `master` runs `.github/workflows/deploy.yml`, which builds the site and publishes `dist/` to GitHub Pages. The live site is at **https://ashesh3.github.io/steam-totp-web/**.

The build script uses `vite build --base=./` so the bundle works correctly when served from a subpath (e.g. `*.github.io/steam-totp-web/`).

## License

MIT
