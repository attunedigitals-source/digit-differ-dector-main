// /lib/pkce.ts
import crypto from "crypto";

export function generateVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

export function generateChallenge(verifier: string) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}
