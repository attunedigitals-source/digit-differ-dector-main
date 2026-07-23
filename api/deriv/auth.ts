import { NextApiRequest, NextApiResponse } from 'next';
import { generateCodeVerifier, generateCodeChallenge, generateState } from '../../../lib/pkce';

const CLIENT_ID = process.env.VITE_DERIV_APP_ID || '';
const REDIRECT_URI = process.env.VITE_DERIV_REDIRECT_URL || 'https://digitbotpro.com/api/deriv/callback';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateState();

  const authUrl = new URL('https://oauth.deriv.com/oauth2/authorize');
  authUrl.searchParams.set('app_id', CLIENT_ID);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', 'trade account_manage');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // Set cookies for the verifier and state to be used in the callback
  res.setHeader('Set-Cookie', [
    `deriv_verifier=${verifier}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`,
    `deriv_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`
  ]);

  res.redirect(authUrl.toString());
}
