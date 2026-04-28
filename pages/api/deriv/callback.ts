import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { code, state, error } = req.query;

  if (error) {
    res.status(400).json({ error: String(error) });
    return;
  }

  if (!code || !state) {
    res.status(400).json({ error: "Missing OAuth code or state" });
    return;
  }

  // TODO: Exchange code for access token with Deriv OAuth endpoint.
  // TODO: Validate state and persist resulting account details.
  res.status(200).json({ message: "Callback received", code, state });
}
