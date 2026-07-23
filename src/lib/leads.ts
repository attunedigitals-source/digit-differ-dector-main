import { supabase } from "@/integrations/supabase/client";

export interface LeadData {
  email: string;
  phone: string;
  source: "tiktok_paid" | "organic_direct";
  whatsappOptIn?: boolean;
  name?: string;
  password?: string;
  userId?: string;
  rstate?: string;
  derivLoginId?: string;
  derivAccounts?: string[];
  createdAt?: string;
}

export const TIKTOK_PIXEL_ID = import.meta.env.VITE_TIKTOK_PIXEL_ID || "D9GASABC77UBS5FSL7C0";
export const WHATSAPP_GROUP_URL = import.meta.env.VITE_WHATSAPP_GROUP_URL || "https://chat.whatsapp.com/B5QnMkxnHMeEXnW7HUfIPS";

/**
 * Computes SHA-256 hash of string using Web Crypto API for TikTok PII matching.
 */
export async function sha256Hash(str: string): Promise<string> {
  if (!str) return "";
  const normalized = str.trim().toLowerCase();
  try {
    if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(normalized);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (e) {
    console.warn("[Leads] Could not hash string with SHA-256:", e);
  }
  return normalized;
}

/**
 * Generates a unique random user_id for a registered user.
 */
export function generateUserId(email?: string): string {
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `usr_${randomHex}`;
}

/**
 * Generates a random State (RState) for a user_id & email and saves it to database & storage.
 */
export async function createAndSaveRState(email: string, existingUserId?: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const userId = existingUserId || generateUserId(cleanEmail);
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const rstate = `rst_${userId.replace(/^usr_/, "").substring(0, 6)}_${randomHex}`;

  const record = {
    userId,
    email: cleanEmail,
    rstate,
    createdAt: new Date().toISOString(),
  };

  // 1. Save in LocalStorage
  localStorage.setItem(`oauth_rstate_${cleanEmail}`, JSON.stringify(record));
  localStorage.setItem("active_oauth_rstate", JSON.stringify(record));

  // 2. Save in Supabase table 'oauth_states' & update leads & profiles
  try {
    await supabase.from("oauth_states" as any).upsert({
      user_id: userId,
      email: cleanEmail,
      rstate,
      created_at: new Date().toISOString(),
    }, { onConflict: "email" });
  } catch (e) {
    console.warn("[Leads] Supabase 'oauth_states' notice:", e);
  }

  try {
    await supabase.from("leads" as any).update({
      user_id: userId,
      rstate,
    }).eq("email", cleanEmail);

    await supabase.from("profiles" as any).update({
      user_id: userId,
      rstate,
    }).eq("email", cleanEmail);
  } catch (e) {}

  console.log(`[Leads] Generated RState '${rstate}' for user '${cleanEmail}' (${userId})`);
  return rstate;
}

/**
 * Associates an RState with an authenticated Deriv Account, then deletes RState for security.
 */
export async function consumeRState(rstate: string): Promise<{ email: string; userId: string } | null> {
  if (!rstate) return null;
  const cleanState = rstate.trim();

  let matchedEmail: string | null = null;
  let matchedUserId: string | null = null;

  // 1. Check active LocalStorage RState
  try {
    const rawActive = localStorage.getItem("active_oauth_rstate");
    if (rawActive) {
      const parsed = JSON.parse(rawActive);
      if (parsed?.rstate === cleanState && parsed?.email) {
        matchedEmail = parsed.email.toLowerCase();
        matchedUserId = parsed.userId || "";
      }
    }
  } catch (e) {}

  // 2. Search captured leads in LocalStorage
  if (!matchedEmail) {
    try {
      const rawLeads = localStorage.getItem("digit_bot_captured_leads");
      if (rawLeads) {
        const leads: LeadData[] = JSON.parse(rawLeads);
        const found = leads.find((l) => l.rstate === cleanState);
        if (found) {
          matchedEmail = found.email.toLowerCase();
          matchedUserId = found.userId || "";
        }
      }
    } catch (e) {}
  }

  // 3. Search Supabase table 'oauth_states'
  if (!matchedEmail) {
    try {
      const { data: stRow } = await supabase
        .from("oauth_states" as any)
        .select("*")
        .eq("rstate", cleanState)
        .maybeSingle();

      if (stRow?.email) {
        matchedEmail = stRow.email.toLowerCase();
        matchedUserId = stRow.user_id || "";
      }
    } catch (e) {}
  }

  // 4. Search Supabase table 'leads' or 'profiles'
  if (!matchedEmail) {
    try {
      const { data: leadRow } = await supabase
        .from("leads" as any)
        .select("*")
        .eq("rstate", cleanState)
        .maybeSingle();

      if (leadRow?.email) {
        matchedEmail = leadRow.email.toLowerCase();
        matchedUserId = leadRow.user_id || "";
      }
    } catch (e) {}
  }

  // 5. DELETE RState value after single use for security reasons
  if (cleanState) {
    try {
      localStorage.removeItem("active_oauth_rstate");
      if (matchedEmail) {
        localStorage.removeItem(`oauth_rstate_${matchedEmail}`);
      }

      // Clear rstate from LocalStorage captured leads list
      const existingLeadsRaw = localStorage.getItem("digit_bot_captured_leads");
      if (existingLeadsRaw) {
        try {
          const leads: LeadData[] = JSON.parse(existingLeadsRaw);
          let modified = false;
          leads.forEach((l) => {
            if (l.rstate === cleanState || (matchedEmail && l.email.toLowerCase() === matchedEmail)) {
              delete l.rstate;
              modified = true;
            }
          });
          if (modified) {
            localStorage.setItem("digit_bot_captured_leads", JSON.stringify(leads));
          }
        } catch (e) {}
      }

      await supabase.from("oauth_states" as any).delete().eq("rstate", cleanState);
      if (matchedEmail) {
        await supabase.from("leads" as any).update({ rstate: null }).eq("email", matchedEmail);
        await supabase.from("profiles" as any).update({ rstate: null }).eq("email", matchedEmail);
      }
    } catch (e) {
      console.warn("[Leads] Notice deleting RState:", e);
    }
  }

  if (matchedEmail) {
    console.log(`[Leads] Consumed & deleted RState '${cleanState}' for user '${matchedEmail}'`);
    return { email: matchedEmail, userId: matchedUserId || "" };
  }

  return null;
}

/**
 * Saves lead details to Supabase table `leads` & `profiles` if available, and backup to localStorage.
 */
export async function submitLead(data: LeadData): Promise<{ success: boolean; message: string }> {
  try {
    const timestamp = new Date().toISOString();
    const userId = data.userId || generateUserId(data.email);
    const rstate = await createAndSaveRState(data.email, userId);

    const leadRecord: LeadData = {
      ...data,
      userId,
      rstate,
      createdAt: timestamp,
    };

    // 1. Backup to localStorage array
    const existingLeadsRaw = localStorage.getItem("digit_bot_captured_leads");
    let existingLeads: LeadData[] = existingLeadsRaw ? JSON.parse(existingLeadsRaw) : [];
    if (!Array.isArray(existingLeads)) existingLeads = [];
    
    // Filter out previous duplicate by email if re-registering
    existingLeads = existingLeads.filter((l) => l.email.toLowerCase() !== data.email.toLowerCase());
    existingLeads.push(leadRecord);
    
    localStorage.setItem("digit_bot_captured_leads", JSON.stringify(existingLeads));
    localStorage.setItem("last_registered_lead_email", data.email.trim().toLowerCase());
    localStorage.setItem("pending_lead_to_associate", JSON.stringify(leadRecord));

    // 2. Insert into Supabase table 'leads' if it exists
    const { error: leadsErr } = await supabase.from("leads" as any).insert({
      user_id: userId,
      rstate,
      email: data.email,
      phone: data.phone,
      name: data.name || null,
      source: data.source,
      whatsapp_opt_in: data.whatsappOptIn ?? true,
      created_at: timestamp,
    });

    if (leadsErr) {
      console.warn("[Leads] Supabase 'leads' insert notice:", leadsErr.message);
    } else {
      console.log(`[Leads] Lead saved to Supabase 'leads' table with userId ${userId} & RState ${rstate}: ${data.email}`);
    }

    // 3. Upsert into Supabase table 'profiles' so it shows up in main profiles table
    try {
      await supabase.from("profiles" as any).upsert({
        user_id: userId,
        rstate,
        email: data.email,
        phone: data.phone,
        full_name: data.name || null,
        lead_source: data.source,
        whatsapp_opt_in: data.whatsappOptIn ?? true,
        updated_at: timestamp,
      }, { onConflict: "email" });
    } catch (profErr: any) {
      console.warn("[Leads] Supabase 'profiles' upsert notice:", profErr?.message);
    }

    // 4. Save current active client user info for welcome portal
    const clientUser = {
      email: data.email,
      name: data.name || "Valued Client",
      phone: data.phone,
    };
    localStorage.setItem("current_client_user", JSON.stringify(clientUser));

    // 5. Attempt Supabase Auth Sign Up if password provided
    if (data.password) {
      try {
        await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: {
              full_name: data.name || null,
              phone: data.phone,
            },
          },
        });
      } catch (authErr: any) {
        console.warn("[Leads] Supabase auth signup notice:", authErr?.message);
      }
    }

    return { success: true, message: "Lead submitted successfully." };
  } catch (err: any) {
    console.error("[Leads] Error submitting lead:", err);
    return { success: true, message: "Lead captured." };
  }
}

/**
 * Authenticates a client using Email & Password.
 */
export async function loginClientUser(
  email: string,
  password: string
): Promise<{ success: boolean; message: string; name?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try Supabase Auth Sign In first
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (!authErr && authData?.user) {
      const userMeta = authData.user.user_metadata || {};
      const name = userMeta.full_name || userMeta.name || cleanEmail.split("@")[0];
      const clientUser = { email: cleanEmail, name, phone: userMeta.phone || "" };
      localStorage.setItem("current_client_user", JSON.stringify(clientUser));
      return { success: true, message: "Login successful", name };
    }

    // 2. Fallback check local storage leads database
    const existingLeadsRaw = localStorage.getItem("digit_bot_captured_leads");
    const existingLeads: LeadData[] = existingLeadsRaw ? JSON.parse(existingLeadsRaw) : [];
    const foundLead = existingLeads.find((l) => l.email.toLowerCase() === cleanEmail);

    if (foundLead) {
      // Check password if set or allow login for registered leads
      if (!foundLead.password || foundLead.password === password) {
        const clientUser = {
          email: foundLead.email,
          name: foundLead.name || foundLead.email.split("@")[0],
          phone: foundLead.phone || "",
        };
        localStorage.setItem("current_client_user", JSON.stringify(clientUser));
        return { success: true, message: "Login successful", name: clientUser.name };
      }
    }

    // 3. Fallback: If registered email exists in profiles table
    const { data: profile } = await supabase
      .from("profiles" as any)
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (profile) {
      const name = profile.full_name || profile.name || cleanEmail.split("@")[0];
      const clientUser = { email: cleanEmail, name, phone: profile.phone || "" };
      localStorage.setItem("current_client_user", JSON.stringify(clientUser));
      return { success: true, message: "Login successful", name };
    }

    return { success: false, message: "Invalid email or password. Please check your credentials." };
  } catch (err: any) {
    console.error("[Leads] Client login error:", err);
    return { success: false, message: err.message || "Authentication error." };
  }
}

/**
 * Returns currently logged-in client user details for welcome greeting.
 */
export function getCurrentClientUser(): { email: string; name: string; phone?: string } | null {
  try {
    const raw = localStorage.getItem("current_client_user");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.name) return parsed;
    }
  } catch (e) {
    // non-fatal
  }
  return null;
}

/**
 * Automatically links an authenticated Deriv account ID to the registered lead email.
 */
export async function associateDerivAccount(derivLoginId: string, derivAccounts: string[] = [], rstate?: string): Promise<void> {
  try {
    if (!derivLoginId) return;

    // 1. Resolve lead email from RState or session sources
    let targetEmail: string | undefined;

    // Source 0: Consume and match RState returned by Deriv callback
    if (rstate) {
      const consumed = await consumeRState(rstate);
      if (consumed?.email) {
        targetEmail = consumed.email.toLowerCase();
        console.log(`[Leads] Matched RState '${rstate}' to registered email: ${targetEmail}`);
      }
    }

    // Source A: Currently active logged-in client user
    if (!targetEmail) {
      const currentClient = getCurrentClientUser();
      if (currentClient?.email) {
        targetEmail = currentClient.email.toLowerCase();
      }
    }

    // Source B: Pending lead to associate
    if (!targetEmail) {
      const pendingLeadRaw = localStorage.getItem("pending_lead_to_associate");
      if (pendingLeadRaw) {
        try {
          const pending = JSON.parse(pendingLeadRaw);
          if (pending?.email) targetEmail = pending.email.toLowerCase();
        } catch (e) {}
      }
    }

    // Source C: Last registered lead email
    if (!targetEmail) {
      const lastEmail = localStorage.getItem("last_registered_lead_email");
      if (lastEmail) targetEmail = lastEmail.toLowerCase();
    }

    // Source D: Active Supabase Auth user session
    if (!targetEmail) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.email && !authData.user.email.endsWith("@deriv-user.local")) {
          targetEmail = authData.user.email.toLowerCase();
        }
      } catch (e) {}
    }

    // Source E: Fallback - query Supabase 'leads' table for latest unlinked lead
    if (!targetEmail) {
      try {
        const { data: latestUnlinked } = await supabase
          .from("leads" as any)
          .select("*")
          .is("deriv_loginid", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestUnlinked?.email) {
          targetEmail = latestUnlinked.email.toLowerCase();
        }
      } catch (e) {}
    }

    // Update LocalStorage captured leads list
    const existingLeadsRaw = localStorage.getItem("digit_bot_captured_leads");
    let existingLeads: LeadData[] = existingLeadsRaw ? JSON.parse(existingLeadsRaw) : [];
    if (Array.isArray(existingLeads)) {
      let idx = -1;
      if (targetEmail) {
        idx = existingLeads.findIndex((l) => l.email.toLowerCase() === targetEmail);
      }
      if (idx === -1 && existingLeads.length > 0) {
        idx = existingLeads.findIndex((l) => !l.derivLoginId);
        if (idx === -1) idx = existingLeads.length - 1;
      }

      if (idx !== -1 && existingLeads[idx]) {
        existingLeads[idx].derivLoginId = derivLoginId;
        existingLeads[idx].derivAccounts = derivAccounts;
        if (!targetEmail) targetEmail = existingLeads[idx].email;
        localStorage.setItem("digit_bot_captured_leads", JSON.stringify(existingLeads));
        console.log(`[Leads] Automatically associated Deriv account ${derivLoginId} to local lead ${targetEmail}`);
      }
    }

    // Update Supabase leads & profiles tables
    if (targetEmail) {
      await supabase
        .from("leads" as any)
        .update({ deriv_loginid: derivLoginId, deriv_accounts: derivAccounts })
        .eq("email", targetEmail);

      await supabase
        .from("profiles" as any)
        .update({ deriv_loginid: derivLoginId, deriv_accounts: derivAccounts })
        .eq("email", targetEmail);

      console.log(`[Leads] Automatically updated Deriv account ${derivLoginId} in Supabase for ${targetEmail}`);
    }

    // Also update shadow profile matching `${derivLoginId}@deriv-user.local`
    try {
      const shadowEmail = `${derivLoginId.toLowerCase()}@deriv-user.local`;
      await supabase
        .from("profiles" as any)
        .update({ deriv_loginid: derivLoginId, deriv_accounts: derivAccounts })
        .eq("email", shadowEmail);
    } catch (e) {}
  } catch (err) {
    console.warn("[Leads] Failed to automatically associate Deriv account to lead:", err);
  }
}

/**
 * Manually links a Deriv account ID to a captured lead (Admin Action).
 */
export async function manuallyLinkLeadDerivAccount(email: string, derivLoginId: string): Promise<boolean> {
  try {
    if (!email || !derivLoginId) return false;
    const cleanEmail = email.trim().toLowerCase();
    const cleanDerivId = derivLoginId.trim();

    // 1. Update localStorage
    const existingLeadsRaw = localStorage.getItem("digit_bot_captured_leads");
    let existingLeads: LeadData[] = existingLeadsRaw ? JSON.parse(existingLeadsRaw) : [];
    if (Array.isArray(existingLeads)) {
      const idx = existingLeads.findIndex((l) => l.email.toLowerCase() === cleanEmail);
      if (idx !== -1) {
        existingLeads[idx].derivLoginId = cleanDerivId;
        localStorage.setItem("digit_bot_captured_leads", JSON.stringify(existingLeads));
      }
    }

    // 2. Update Supabase leads table
    await supabase
      .from("leads" as any)
      .update({ deriv_loginid: cleanDerivId })
      .eq("email", cleanEmail);

    // 3. Update Supabase profiles table
    await supabase
      .from("profiles" as any)
      .update({ deriv_loginid: cleanDerivId })
      .eq("email", cleanEmail);

    console.log(`[Leads] Admin manually linked Deriv account ${cleanDerivId} to ${cleanEmail}`);
    return true;
  } catch (e) {
    console.error("[Leads] Error manually linking lead Deriv account:", e);
    return false;
  }
}

/**
 * Deletes a lead record across Supabase leads table, profiles table, and local storage.
 */
export async function deleteLeadRecord(email: string): Promise<boolean> {
  try {
    if (!email) return false;
    const cleanEmail = email.trim().toLowerCase();

    // 1. Remove from localStorage backup
    const existingLeadsRaw = localStorage.getItem("digit_bot_captured_leads");
    let existingLeads: LeadData[] = existingLeadsRaw ? JSON.parse(existingLeadsRaw) : [];
    if (Array.isArray(existingLeads)) {
      existingLeads = existingLeads.filter((l) => l.email.toLowerCase() !== cleanEmail);
      localStorage.setItem("digit_bot_captured_leads", JSON.stringify(existingLeads));
    }

    const lastEmail = localStorage.getItem("last_registered_lead_email");
    if (lastEmail && lastEmail.toLowerCase() === cleanEmail) {
      localStorage.removeItem("last_registered_lead_email");
    }

    // 2. Delete from Supabase 'leads' table
    await supabase
      .from("leads" as any)
      .delete()
      .eq("email", cleanEmail);

    // 3. Delete from Supabase 'profiles' table
    try {
      await supabase
        .from("profiles" as any)
        .delete()
        .eq("email", cleanEmail);
    } catch (e) {
      // non-fatal
    }

    console.log(`[Leads] Successfully deleted lead record for ${cleanEmail}`);
    return true;
  } catch (err) {
    console.error("[Leads] Error deleting lead record:", err);
    return false;
  }
}

/**
 * Retrieves and merges all captured leads from local storage and Supabase tables.
 */
export async function getCapturedLeads(): Promise<LeadData[]> {
  const leadMap = new Map<string, LeadData>();

  // 1. Load from localStorage backup
  try {
    const rawLocal = localStorage.getItem("digit_bot_captured_leads");
    if (rawLocal) {
      const parsed: LeadData[] = JSON.parse(rawLocal);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item.email) {
            leadMap.set(item.email.toLowerCase(), item);
          }
        });
      }
    }
  } catch (e) {
    console.warn("[Leads] Could not read local leads backup:", e);
  }

  // 2. Load from Supabase 'leads' table
  try {
    const { data: leadsData } = await supabase
      .from("leads" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (Array.isArray(leadsData)) {
      leadsData.forEach((row: any) => {
        if (row.email) {
          const key = row.email.toLowerCase();
          const existing = leadMap.get(key);
          leadMap.set(key, {
            email: row.email,
            phone: row.phone || existing?.phone || "",
            name: row.name || existing?.name || "",
            source: row.source || existing?.source || "tiktok_paid",
            whatsappOptIn: row.whatsapp_opt_in ?? existing?.whatsappOptIn ?? true,
            derivLoginId: row.deriv_loginid || existing?.derivLoginId,
            derivAccounts: row.deriv_accounts || existing?.derivAccounts,
            createdAt: row.created_at || existing?.createdAt || new Date().toISOString(),
          });
        }
      });
    }
  } catch (e) {
    console.warn("[Leads] Could not fetch Supabase 'leads' table:", e);
  }

  // 3. Load from Supabase 'profiles' table
  try {
    const { data: profilesData } = await supabase
      .from("profiles" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (Array.isArray(profilesData)) {
      // Build a map of profiles by deriv_loginid or email
      const profilesByDerivId = new Map<string, any>();
      profilesData.forEach((p: any) => {
        if (p.email && p.email.endsWith("@deriv-user.local")) {
          const derivId = p.email.split("@")[0].toUpperCase();
          profilesByDerivId.set(derivId, p);
        }
      });

      profilesData.forEach((row: any) => {
        if (row.email && !row.email.endsWith("@deriv-user.local")) {
          const key = row.email.toLowerCase();
          const existing = leadMap.get(key);
          if (existing) {
            leadMap.set(key, {
              ...existing,
              phone: row.phone || existing.phone,
              name: row.full_name || row.name || existing.name,
              derivLoginId: row.deriv_loginid || existing.derivLoginId,
            });
          }
        }
      });

      // 4. Smart proximity matching: If a lead still has no derivLoginId, check profiles
      const leadList = Array.from(leadMap.values());
      const shadowProfiles = Array.from(profilesByDerivId.values());

      leadList.forEach((lead) => {
        if (!lead.derivLoginId && shadowProfiles.length > 0) {
          // Match by closest created_at timestamp
          const leadTime = new Date(lead.createdAt || 0).getTime();
          let closestProfile: any = null;
          let minDiff = Infinity;

          shadowProfiles.forEach((prof) => {
            const profTime = new Date(prof.created_at || 0).getTime();
            const diff = Math.abs(leadTime - profTime);
            // If created within 24 hours of each other or latest profile
            if (diff < minDiff && diff < 24 * 60 * 60 * 1000) {
              minDiff = diff;
              closestProfile = prof;
            }
          });

          if (closestProfile) {
            const derivId = closestProfile.email.split("@")[0].toUpperCase();
            lead.derivLoginId = derivId;
            leadMap.set(lead.email.toLowerCase(), lead);
          } else if (shadowProfiles.length === 1 && leadList.length === 1) {
            // Single lead & single Deriv user
            const derivId = shadowProfiles[0].email.split("@")[0].toUpperCase();
            lead.derivLoginId = derivId;
            leadMap.set(lead.email.toLowerCase(), lead);
          }
        }
      });
    }
  } catch (e) {
    console.warn("[Leads] Could not fetch Supabase 'profiles' table:", e);
  }

  return Array.from(leadMap.values()).sort((a, b) => {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

/**
 * Initializes, identifies user PII (hashed), and triggers TikTok Pixel event tracking.
 */
export async function fireTikTokPixelEvent(
  eventName: string = "CompleteRegistration",
  customData: Record<string, any> = {},
  userInfo?: { email?: string; phone?: string; externalId?: string }
) {
  try {
    const windowObj = window as any;

    if (typeof windowObj.ttq === "undefined") {
      // Inject TikTok Pixel Script dynamically if not present
      (function (w: any, d: any, t: string) {
        w.TiktokAnalyticsObject = t;
        const ttq = (w[t] = w[t] || []);
        ttq.methods = [
          "page", "track", "identify", "instances", "debug", "on", "off",
          "once", "ready", "alias", "group", "enableCookie", "disableCookie"
        ];
        ttq.setAndDefer = function (t: any, e: any) {
          t[e] = function () {
            t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
          };
        };
        for (let i = 0; i < ttq.methods.length; i++) {
          ttq.setAndDefer(ttq, ttq.methods[i]);
        }
        ttq.instance = function (t: any) {
          const e = ttq._i[t] || [];
          for (let n = 0; n < ttq.methods.length; n++) {
            ttq.setAndDefer(e, ttq.methods[n]);
          }
          return e;
        };
        ttq.load = function (e: any, n: any) {
          const i = "https://analytics.tiktok.com/i18n/pixel/events.js";
          ttq._i = ttq._i || {};
          ttq._i[e] = [];
          ttq._i[e]._u = i;
          ttq._t = ttq._t || {};
          ttq._t[e] = +new Date();
          ttq._o = ttq._o || {};
          ttq._o[e] = n || {};
          const c = d.createElement("script");
          c.type = "text/javascript";
          c.async = true;
          c.src = i + "?sdkid=" + e + "&lib=" + t;
          const s = d.getElementsByTagName("script")[0];
          if (s && s.parentNode) {
            s.parentNode.insertBefore(c, s);
          } else if (d.head) {
            d.head.appendChild(c);
          }
        };

        if (TIKTOK_PIXEL_ID && TIKTOK_PIXEL_ID !== "C1234567890") {
          ttq.load(TIKTOK_PIXEL_ID);
          ttq.page();
        }
      })(window, document, "ttq");
    }

    if (windowObj.ttq) {
      // 1. Identify user PII if provided (SHA-256 hashed on client side)
      if (userInfo && (userInfo.email || userInfo.phone || userInfo.externalId)) {
        const identifyPayload: Record<string, string> = {};
        if (userInfo.email) {
          identifyPayload.email = await sha256Hash(userInfo.email);
        }
        if (userInfo.phone) {
          const cleanPhone = userInfo.phone.replace(/[^\d+]/g, "");
          identifyPayload.phone_number = await sha256Hash(cleanPhone);
        }
        if (userInfo.externalId) {
          identifyPayload.external_id = await sha256Hash(userInfo.externalId);
        }

        if (typeof windowObj.ttq.identify === "function") {
          windowObj.ttq.identify(identifyPayload);
          console.log("[TikTok Pixel] ttq.identify executed with SHA-256 hashed PII", identifyPayload);
        }
      }

      // 2. Track TikTok Pixel Event with formatted parameters
      if (typeof windowObj.ttq.track === "function") {
        const eventParams = {
          contents: [
            {
              content_id: customData.content_id || "digit_bot_pro_sub",
              content_type: customData.content_type || "product",
              content_name: customData.content_name || "Digit Bot Pro Registration",
            },
          ],
          value: customData.value || 0,
          currency: customData.currency || "USD",
          ...customData,
        };

        windowObj.ttq.track(eventName, eventParams);
        console.log(`[TikTok Pixel] ttq.track('${eventName}') executed with params:`, eventParams);
      }
    }
  } catch (e) {
    console.warn("[TikTok Pixel] Could not fire pixel event:", e);
  }
}
