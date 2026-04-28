import { createHash, randomBytes } from "crypto";

function base64UrlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function generateCodeVerifier(length = 32): string {
  return base64UrlEncode(randomBytes(length));
}

export function generateCodeChallenge(verifier: string): string {
  const digest = createHash("sha256").update(verifier).digest();
  return base64UrlEncode(digest);
}

export function generateState(): string {
  return base64UrlEncode(randomBytes(16));
}
