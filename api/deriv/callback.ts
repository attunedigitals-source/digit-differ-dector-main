import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '../../../lib/supabase';

const CLIENT_ID = process.env.VITE_DERIV_APP_ID || '';
const REDIRECT_URI = process.env.VITE_DERIV_REDIRECT_URL || 'https://digitbotpro.com/api/deriv/callback';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state, error } = req.query;

  if (error) {
    return res.redirect(`/auth/error?error=${error}`);
  }

  // Get verifier and state from cookies
  const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>) || {};

  const savedVerifier = cookies['deriv_verifier'];
  const savedState = cookies['deriv_state'];

  if (!savedVerifier || state !== savedState) {
    return res.status(400).json({ error: 'Invalid state or missing verifier' });
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://oauth.deriv.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Deriv-App-ID': CLIENT_ID,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        code: code as string,
        code_verifier: savedVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      throw new Error(errorData.error_description || 'Token exchange failed');
    }

    const data = await tokenResponse.json();
    
    // Save token to Supabase or return to client
    // Note: We need the user_id here. Usually, this would be stored in the session/cookie.
    // For now, let's redirect back to the app with the token or a success flag
    
    res.redirect(`/callback?code=${code}&state=${state}`); // Or handle full exchange here
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
