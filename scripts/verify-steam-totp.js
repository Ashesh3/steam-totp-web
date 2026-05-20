// Verifies the Steam Guard implementation against the gizmo-ds/totp-wasm
// reference vector. Run with: `node scripts/verify-steam-totp.js`
import {
  generateSteamCode,
  normalizeSecret,
  base32Decode,
  isValidBase32,
} from '../src/steam-totp.js';

const cases = [
  // Reference vector from gizmo-ds/totp-wasm
  { secret: 'GM4VC2CQN5UGS33ZJJVWYUSFMQ4HOQJW', t: 1662681600, expected: '4PRPM' },
  // Same vector, but with steam:// prefix and lowercase
  { secret: 'steam://gm4vc2cqn5ugs33zjjvwyusfmq4hoqjw', t: 1662681600, expected: '4PRPM' },
  // With spaces/hyphens
  { secret: 'GM4V C2CQ-N5UG S33Z JJVW YUSF MQ4H OQJW', t: 1662681600, expected: '4PRPM' },
];

let failed = 0;
for (const { secret, t, expected } of cases) {
  const got = await generateSteamCode(secret, t);
  const ok = got === expected;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  t=${t}  expected=${expected}  got=${got}  secret=${secret}`);
}

// Normalization checks
const norm = normalizeSecret(' steam://gm4vc2cq-n5ugs33z jjvwyusfmq4hoqjw ');
console.log(`Normalized: ${norm}`);
if (norm !== 'GM4VC2CQN5UGS33ZJJVWYUSFMQ4HOQJW') {
  console.error('Normalization failed');
  failed++;
}

if (!isValidBase32('GM4VC2CQN5UGS33ZJJVWYUSFMQ4HOQJW')) {
  console.error('isValidBase32 false-negative');
  failed++;
}
if (isValidBase32('!!!invalid!!!')) {
  console.error('isValidBase32 false-positive');
  failed++;
}

// Base32 decoded length sanity
const bytes = base32Decode('GM4VC2CQN5UGS33ZJJVWYUSFMQ4HOQJW');
if (bytes.length !== 20) {
  console.error(`Expected 20-byte key, got ${bytes.length}`);
  failed++;
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed.');
