import crypto from 'crypto';

/**
 * Generates a cryptographically random string to be used as a code verifier.
 * @returns A base64url encoded random string.
 */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Generates a code challenge from a code verifier using S256 method.
 * @param verifier The code verifier string.
 * @returns A base64url encoded SHA-256 hash of the verifier.
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

/**
 * Generates a random state string for CSRF protection.
 */
export function generateState(): string {
  return crypto.randomUUID();
}
