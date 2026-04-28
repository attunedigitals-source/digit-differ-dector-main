import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const { userId } = req.query;

  if (typeof userId !== "string" || !userId) {
    res.status(400).json({ error: "Missing userId" });
    return;
  }

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, deriv_account, deriv_token_status")
    .eq("id", userId)
    .single();

  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ account: data });
}
