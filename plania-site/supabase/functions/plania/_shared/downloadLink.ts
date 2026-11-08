// Short-lived, tamper-proof download links. The project's portal token (a long
// random secret) signs the project id plus an expiry, so no extra storage or
// secret is needed.

const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

export async function signDownload(projectId: string, exp: number, secret: string): Promise<string> {
  const key = await importKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${projectId}.${exp}`));
  return base64url(new Uint8Array(signature));
}

export async function verifyDownload(
  projectId: string,
  exp: number,
  sig: string,
  secret: string
): Promise<boolean> {
  if (!Number.isFinite(exp) || exp * 1000 < Date.now() || !sig) return false;
  const expected = await signDownload(projectId, exp, secret);
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  }
  return diff === 0;
}