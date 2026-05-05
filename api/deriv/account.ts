import { NextApiRequest, NextApiResponse } from 'next';

const CLIENT_ID = process.env.VITE_DERIV_APP_ID || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  try {
    const response = await fetch('https://api.deriv.com/api-v2/accounts', {
      headers: {
        'Authorization': authHeader,
        'Deriv-App-ID': CLIENT_ID,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
