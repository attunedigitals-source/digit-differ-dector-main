/**
 * Generates a cryptographically random string to be used as a code verifier.
 * @returns A base64url encoded random string.
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  window.crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/**
 * Generates a code challenge from a code verifier using S256 method.
 * @param verifier The code verifier string.
 * @returns A base64url encoded SHA-256 hash of the verifier.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Encodes a buffer to base64url string.
 * @param array The buffer to encode.
 * @returns A base64url encoded string.
 */
function base64UrlEncode(array: Uint8Array): string {
  return btoa(String.fromCharCode(...Array.from(array)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Generates a random state string for CSRF protection.
 */
export function generateState(): string {
  return window.crypto.randomUUID ? window.crypto.randomUUID() : generateCodeVerifier();
}

