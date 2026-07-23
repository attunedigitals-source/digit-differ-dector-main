export async function generatePKCE() {
  // 1. Generate a random code_verifier
  const array = crypto.getRandomValues(new Uint8Array(64));
  const codeVerifier = Array.from(array)
    .map(v => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[v % 66])
    .join('');

  // 2. Derive the code_challenge
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // 3. Generate a random state for CSRF protection
  const state = crypto.getRandomValues(new Uint8Array(16))
    .reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

  return {
    codeVerifier,
    codeChallenge,
    state
  };
}

export function storePKCEData(codeVerifier: string, state: string) {
  sessionStorage.setItem('pkce_code_verifier', codeVerifier);
  sessionStorage.setItem('oauth_state', state);
}

export function getPKCEData() {
  return {
    codeVerifier: sessionStorage.getItem('pkce_code_verifier'),
    state: sessionStorage.getItem('oauth_state')
  };
}

export function clearPKCEData() {
  sessionStorage.removeItem('pkce_code_verifier');
  sessionStorage.removeItem('oauth_state');
}
