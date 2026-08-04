/**
 * Brevo Integration Helper
 * Syncs newly registered users to Brevo contact list (List ID 3 by default)
 * for automated email sequences.
 */
import { supabase } from "@/integrations/supabase/client";

const ENCODED_BREVO_KEY = "eGtleXNpYi0yOWFjOTczODgzNzRiNjFlNGEyOGM2OGM1YzEzZGFhYzUxMWJmZWY3MTQzNjI1NzZhMjllZDk4YTdhYjc5NmViLUgzbDZSbzc0UnE0c0FCdA==";

function getFallbackBrevoKey(): string {
  try {
    if (typeof atob === "function") {
      return atob(ENCODED_BREVO_KEY);
    }
    if (typeof Buffer !== "undefined") {
      return Buffer.from(ENCODED_BREVO_KEY, "base64").toString("utf-8");
    }
  } catch (e) {}
  return "";
}

export const DEFAULT_BREVO_API_KEY = getFallbackBrevoKey();

export const BREVO_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BREVO_API_KEY) ||
  (typeof process !== "undefined" && process.env && process.env.VITE_BREVO_API_KEY) ||
  DEFAULT_BREVO_API_KEY;

export const BREVO_LIST_ID = Number(
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BREVO_LIST_ID) ||
  (typeof process !== "undefined" && process.env && process.env.VITE_BREVO_LIST_ID) ||
  3
);

export interface BrevoContactInput {
  email: string;
  name?: string;
  phone?: string;
  source?: string;
  listId?: number;
}

/**
 * Adds or updates a contact in Brevo list (List ID 3 by default).
 * Sets updateEnabled to true so existing contacts get updated and added to the sequence list.
 * Includes automatic retry without duplicate/invalid SMS if phone number format fails in Brevo.
 */
export async function addContactToBrevo(input: BrevoContactInput): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const cleanEmail = input.email ? input.email.trim().toLowerCase() : "";
    if (!cleanEmail) {
      return { success: false, error: "Email is required" };
    }

    const apiKey = BREVO_API_KEY || DEFAULT_BREVO_API_KEY || getFallbackBrevoKey();
    if (!apiKey) {
      console.warn("[Brevo Notice] BREVO_API_KEY is missing.");
      return { success: false, error: "Brevo API key missing" };
    }

    const attributes: Record<string, any> = {};

    if (input.name && input.name.trim()) {
      const nameParts = input.name.trim().split(" ");
      attributes.FIRSTNAME = nameParts[0];
      if (nameParts.length > 1) {
        attributes.LASTNAME = nameParts.slice(1).join(" ");
      }
    }

    if (input.phone && input.phone.trim()) {
      const cleanPhone = input.phone.trim();
      // Only attach phone attributes if cleanPhone contains digits
      if (/\d/.test(cleanPhone)) {
        attributes.SMS = cleanPhone;
        attributes.PHONE = cleanPhone;
      }
    }

    if (input.source) {
      attributes.SOURCE = input.source;
    }

    const listIdToUse = input.listId || BREVO_LIST_ID;

    const payload = {
      email: cleanEmail,
      attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
      listIds: [listIdToUse],
      updateEnabled: true,
    };

    console.log(`[Brevo] Syncing contact ${cleanEmail} to Brevo List ID ${listIdToUse}...`);

    const response = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();

      // If SMS is already associated or invalid in Brevo, retry without SMS attribute so email sequence still triggers!
      if (
        (errText.includes("SMS is already associated") ||
          errText.includes("Invalid phone number") ||
          errText.includes("invalid_parameter")) &&
        attributes.SMS
      ) {
        delete attributes.SMS;
        delete attributes.PHONE;
        payload.attributes = Object.keys(attributes).length > 0 ? attributes : undefined;

        const retryResponse = await fetch("https://api.brevo.com/v3/contacts", {
          method: "POST",
          headers: {
            "accept": "application/json",
            "content-type": "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify(payload),
        });

        if (retryResponse.ok) {
          const resData = await retryResponse.json().catch(() => ({}));
          console.log(`[Brevo] Successfully synced contact ${cleanEmail} (without duplicate/invalid SMS) to Brevo List ID ${listIdToUse}`);
          return { success: true, data: resData };
        }
      }

      console.warn(`[Brevo Notice] API returned status ${response.status}:`, errText);
      return { success: false, error: errText };
    }

    const resData = await response.json().catch(() => ({}));
    console.log(`[Brevo] Successfully synced contact ${cleanEmail} to Brevo List ID ${listIdToUse}`);
    return { success: true, data: resData };
  } catch (err: any) {
    console.warn("[Brevo Notice] Network error during Brevo sync:", err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * Synchronizes ALL leads across Supabase (leads, r_users, profiles) & LocalStorage to Brevo List ID 3.
 */
export async function syncAllLeadsToBrevo(): Promise<{ total: number; synced: number; errors: number }> {
  console.log("[Brevo Sync] Starting full Brevo synchronization across Supabase & local storage...");
  const leadsMap = new Map<string, { email: string; name?: string; phone?: string; source?: string }>();

  // 1. Fetch from Supabase 'leads'
  try {
    const { data: leads } = await supabase.from("leads" as any).select("*");
    if (leads && Array.isArray(leads)) {
      leads.forEach((l: any) => {
        if (l.email) {
          const email = l.email.trim().toLowerCase();
          leadsMap.set(email, {
            email,
            name: l.name || l.full_name || leadsMap.get(email)?.name,
            phone: l.phone || l.phone_number || leadsMap.get(email)?.phone,
            source: l.source || l.lead_source || "supabase_leads",
          });
        }
      });
    }
  } catch (e) {
    console.warn("[Brevo Sync] Could not fetch from 'leads' table:", e);
  }

  // 2. Fetch from Supabase 'r_users'
  try {
    const { data: rUsers } = await supabase.from("r_users" as any).select("*");
    if (rUsers && Array.isArray(rUsers)) {
      rUsers.forEach((r: any) => {
        if (r.email) {
          const email = r.email.trim().toLowerCase();
          const existing = leadsMap.get(email);
          leadsMap.set(email, {
            email,
            name: r.full_name || r.name || existing?.name,
            phone: r.phone_number || r.phone || existing?.phone,
            source: existing?.source || "r_users",
          });
        }
      });
    }
  } catch (e) {
    console.warn("[Brevo Sync] Could not fetch from 'r_users' table:", e);
  }

  // 3. Fetch from Supabase 'profiles'
  try {
    const { data: profiles } = await supabase.from("profiles" as any).select("*");
    if (profiles && Array.isArray(profiles)) {
      profiles.forEach((p: any) => {
        if (p.email) {
          const email = p.email.trim().toLowerCase();
          const existing = leadsMap.get(email);
          leadsMap.set(email, {
            email,
            name: p.full_name || existing?.name,
            phone: p.phone || p.whatsapp_number || existing?.phone,
            source: p.lead_source || existing?.source || "profiles",
          });
        }
      });
    }
  } catch (e) {
    console.warn("[Brevo Sync] Could not fetch from 'profiles' table:", e);
  }

  // 4. Fetch from LocalStorage
  try {
    const rawLocal = localStorage.getItem("digit_bot_captured_leads");
    if (rawLocal) {
      const localLeads = JSON.parse(rawLocal);
      if (Array.isArray(localLeads)) {
        localLeads.forEach((l: any) => {
          if (l.email) {
            const email = l.email.trim().toLowerCase();
            const existing = leadsMap.get(email);
            leadsMap.set(email, {
              email,
              name: l.name || existing?.name,
              phone: l.phone || existing?.phone,
              source: l.source || existing?.source || "local_storage",
            });
          }
        });
      }
    }
  } catch (e) {}

  const allLeads = Array.from(leadsMap.values());
  console.log(`[Brevo Sync] Found ${allLeads.length} unique leads across all sources. Syncing to Brevo List ${BREVO_LIST_ID}...`);

  let synced = 0;
  let errors = 0;

  for (const lead of allLeads) {
    const res = await addContactToBrevo({
      email: lead.email,
      name: lead.name,
      phone: lead.phone,
      source: lead.source,
    });
    if (res.success) {
      synced++;
    } else {
      errors++;
    }
  }

  console.log(`[Brevo Sync] Completed! Synced: ${synced}, Errors: ${errors}, Total: ${allLeads.length}`);
  return { total: allLeads.length, synced, errors };
}
