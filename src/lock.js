// The app lock: a 4 to 6 digit code, and fingerprint or face where the phone supports it.
// It is a lock screen, not encryption: it keeps out anyone who picks up the phone.
// The code itself is never saved, only a salted PBKDF2 hash of it.

const ITERATIONS = 150000;
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((h) => parseInt(h, 16)));

export function checkPinFormat(pin) {
  if (!/^\d{4,6}$/.test(String(pin))) throw new Error('الرقم السري لازم يكون من 4 لـ 6 أرقام');
}

async function hashPin(pin, saltHex, iterations) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations }, key, 256);
  return toHex(bits);
}

export async function makeLock(pin, minutes = 1) {
  checkPinFormat(pin);
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, iterations: ITERATIONS, hash: await hashPin(pin, salt, ITERATIONS), length: String(pin).length, minutes, credId: null };
}

export async function pinMatches(lock, pin) {
  if (!lock || !/^\d{4,6}$/.test(String(pin))) return false;
  return (await hashPin(pin, lock.salt, lock.iterations)) === lock.hash;
}

// Whether the screen should lock again after the app was hidden for `awayMs`.
export function shouldRelock(lock, awayMs) {
  return Boolean(lock) && awayMs >= (lock.minutes ?? 1) * 60000;
}

// ---------- Fingerprint / face (WebAuthn, only on the device itself) ----------
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function biometricAvailable() {
  try {
    return Boolean(window.PublicKeyCredential)
      && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerBiometric(name) {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'مزنوق' },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: name || 'maznouq', displayName: name || 'مزنوق' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60000,
    },
  });
  if (!cred) throw new Error('البصمة ماتسجلتش');
  return b64(cred.rawId);
}

export async function unlockWithBiometric(credId) {
  const result = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: unb64(credId) }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  return Boolean(result);
}
