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
 * Generates a random State (RState) for a user_id & email and saves it to the RUsers table in Supabase.
 */
export async function createAndSaveRState(
  email: string,
  existingUserId?: string,
  fullName?: string,
  phone?: string
): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  const userId = existingUserId || generateUserId(cleanEmail);
  const randomHex = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const rstate = `rst_${userId.replace(/^usr_/, "").substring(0, 6)}_${randomHex}`;

  const record = {
    userId,
    email: cleanEmail,
    fullName: fullName || "",
    phone: phone || "",
    rstate,
    createdAt: new Date().toISOString(),
  };

  // 1. Save in LocalStorage
  localStorage.setItem(`oauth_rstate_${cleanEmail}`, JSON.stringify(record));
  localStorage.setItem("active_oauth_rstate", JSON.stringify(record));

  // 2. Step 1 Requirement: Save user_id, email, full_name, phone_number, rstate into RUsers Table ('r_users')
  try {
    await supabase.from("r_users" as any).upsert({
      user_id: userId,
      rstate,
      email: cleanEmail,
      full_name: fullName || null,
      phone_number: phone || null,
      created_at: new Date().toISOString(),
    }, { onConflict: "email" });
  } catch (e) {
    console.warn("[Leads] Supabase 'r_users' notice:", e);
  }

  // Backup in 'rusers' and 'oauth_states' tables
  try {
    await supabase.from("rusers" as any).upsert({
      user_id: userId,
      rstate,
      email: cleanEmail,
      full_name: fullName || null,
      phone_number: phone || null,
      created_at: new Date().toISOString(),
    }, { onConflict: "email" });
  } catch (e) {}

  try {
    await supabase.from("oauth_states" as any).upsert({
      user_id: userId,
      email: cleanEmail,
      rstate,
      created_at: new Date().toISOString(),
    }, { onConflict: "email" });
  } catch (e) {}

  console.log(`[Leads] Saved to RUsers table with user_id '${userId}', email '${cleanEmail}', RState '${rstate}'`);
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

  // Strip/clear rstate after callback result has been received for single unified record
  if (cleanState) {
    try {
      localStorage.removeItem("active_oauth_rstate");
      if (matchedEmail) {
        localStorage.removeItem(`oauth_rstate_${matchedEmail}`);
      }

      await supabase.from("oauth_states" as any).delete().eq("rstate", cleanState);
      if (matchedEmail) {
        await supabase.from("leads" as any).update({ rstate: null }).eq("email", matchedEmail);
        await supabase.from("profiles" as any).update({ rstate: null }).eq("email", matchedEmail);
      }
    } catch (e) {}
  }

  if (matchedEmail) {
    console.log(`[Leads] Stripped & consumed RState '${cleanState}' for user '${matchedEmail}'`);
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
    const rstate = await createAndSaveRState(data.email, userId, data.name, data.phone);

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

    let targetEmail: string | undefined;
    let rUsersDetails: { full_name?: string; email?: string; phone_number?: string; user_id?: string } | null = null;

    // Step 4 Requirement: Compare RState returned from Deriv callback and get details from RUsers table ('r_users')
    if (rstate) {
      const cleanState = rstate.trim();
      try {
        const { data: rRow } = await supabase
          .from("r_users" as any)
          .select("*")
          .eq("rstate", cleanState)
          .maybeSingle();

        if (rRow) {
          rUsersDetails = {
            full_name: rRow.full_name,
            email: rRow.email,
            phone_number: rRow.phone_number,
            user_id: rRow.user_id,
          };
          if (rRow.email) targetEmail = rRow.email.toLowerCase();
        }
      } catch (e) {}

      // Fallback: check rusers table
      if (!targetEmail) {
        try {
          const { data: rRow2 } = await supabase
            .from("rusers" as any)
            .select("*")
            .eq("rstate", cleanState)
            .maybeSingle();

          if (rRow2) {
            rUsersDetails = {
              full_name: rRow2.full_name,
              email: rRow2.email,
              phone_number: rRow2.phone_number,
              user_id: rRow2.user_id,
            };
            if (rRow2.email) targetEmail = rRow2.email.toLowerCase();
          }
        } catch (e) {}
      }
    }

    if (!targetEmail && rstate) {
      const consumed = await consumeRState(rstate);
      if (consumed?.email) targetEmail = consumed.email.toLowerCase();
    }

    if (!targetEmail) {
      const currentClient = getCurrentClientUser();
      if (currentClient?.email) targetEmail = currentClient.email.toLowerCase();
    }

    if (!targetEmail) {
      const pendingLeadRaw = localStorage.getItem("pending_lead_to_associate");
      if (pendingLeadRaw) {
        try {
          const pending = JSON.parse(pendingLeadRaw);
          if (pending?.email) targetEmail = pending.email.toLowerCase();
        } catch (e) {}
      }
    }

    if (!targetEmail) {
      const lastEmail = localStorage.getItem("last_registered_lead_email");
      if (lastEmail) targetEmail = lastEmail.toLowerCase();
    }

    // Step 4 Requirement: Update User table in Supabase (leads & profiles)
    // Do NOT change the UID got from Deriv (derivLoginId e.g. ROT92012918)
    if (targetEmail) {
      let existingAccounts: string[] = [];
      let existingName: string | undefined = undefined;
      let existingPhone: string | undefined = undefined;

      try {
        const { data: existingLead } = await supabase
          .from("leads" as any)
          .select("deriv_accounts, deriv_loginid, name, phone")
          .eq("email", targetEmail)
          .maybeSingle();

        if (existingLead) {
          existingName = existingLead.name;
          existingPhone = existingLead.phone;
          if (Array.isArray(existingLead.deriv_accounts)) {
            existingAccounts = existingLead.deriv_accounts;
          } else if (typeof existingLead.deriv_accounts === "string") {
            try { existingAccounts = JSON.parse(existingLead.deriv_accounts); } catch (e) {}
          }
          if (existingLead.deriv_loginid && !existingAccounts.includes(existingLead.deriv_loginid)) {
            existingAccounts.push(existingLead.deriv_loginid);
          }
        }
      } catch (e) {}

      const mergedAccounts = Array.from(new Set([
        ...existingAccounts,
        ...(derivAccounts || []),
        derivLoginId
      ])).filter(Boolean);

      const fullNameToSave = rUsersDetails?.full_name || existingName || (targetEmail ? targetEmail.split("@")[0] : "");
      const phoneToSave = rUsersDetails?.phone_number || existingPhone || "";

      // Update Supabase table 'leads' (User table) keeping Deriv UID
      await supabase
        .from("leads" as any)
        .upsert({
          user_id: derivLoginId, // Do not change UID got from Deriv
          deriv_loginid: derivLoginId,
          email: targetEmail,
          name: fullNameToSave,
          phone: phoneToSave,
          deriv_accounts: mergedAccounts,
          updated_at: new Date().toISOString(),
        }, { onConflict: "email" });

      // Update Supabase table 'profiles' (User table) keeping Deriv UID
      await supabase
        .from("profiles" as any)
        .upsert({
          user_id: derivLoginId, // Do not change UID got from Deriv
          deriv_loginid: derivLoginId,
          email: targetEmail,
          full_name: fullNameToSave,
          phone: phoneToSave,
          deriv_accounts: mergedAccounts,
          updated_at: new Date().toISOString(),
        }, { onConflict: "email" });

      console.log(`[Leads] Updated User table in Supabase for ${targetEmail} with Deriv UID ${derivLoginId}, Full Name '${fullNameToSave}', Accounts [${mergedAccounts.join(", ")}]`);

      // Update LocalStorage backup
      const existingLeadsRaw = localStorage.getItem("digit_bot_captured_leads");
      let existingLeads: LeadData[] = existingLeadsRaw ? JSON.parse(existingLeadsRaw) : [];
      if (Array.isArray(existingLeads)) {
        const idx = existingLeads.findIndex((l) => l.email.toLowerCase() === targetEmail);
        if (idx !== -1) {
          existingLeads[idx].derivLoginId = derivLoginId;
          existingLeads[idx].derivAccounts = mergedAccounts;
          existingLeads[idx].name = fullNameToSave;
          if (phoneToSave) existingLeads[idx].phone = phoneToSave;
          localStorage.setItem("digit_bot_captured_leads", JSON.stringify(existingLeads));
        }
      }
    }

    // Step 5 Requirement: Delete the RState value after every use for security reasons
    if (rstate) {
      const cleanState = rstate.trim();
      try {
        await supabase.from("r_users" as any).delete().eq("rstate", cleanState);
        await supabase.from("rusers" as any).delete().eq("rstate", cleanState);
        await supabase.from("oauth_states" as any).delete().eq("rstate", cleanState);
      } catch (e) {}
    }
    if (targetEmail) {
      try {
        await supabase.from("r_users" as any).delete().eq("email", targetEmail);
        await supabase.from("rusers" as any).delete().eq("email", targetEmail);
        await supabase.from("oauth_states" as any).delete().eq("email", targetEmail);
      } catch (e) {}
    }

    // Clear RState from local storage
    localStorage.removeItem("active_oauth_rstate");
    if (targetEmail) localStorage.removeItem(`oauth_rstate_${targetEmail}`);

    const rawLeads = localStorage.getItem("digit_bot_captured_leads");
    if (rawLeads) {
      try {
        const leadsArr: LeadData[] = JSON.parse(rawLeads);
        let modified = false;
        leadsArr.forEach((l) => {
          if (l.rstate === rstate || (targetEmail && l.email.toLowerCase() === targetEmail)) {
            delete l.rstate;
            modified = true;
          }
        });
        if (modified) {
          localStorage.setItem("digit_bot_captured_leads", JSON.stringify(leadsArr));
        }
      } catch (e) {}
    }

  } catch (err) {
    console.warn("[Leads] Failed to associate Deriv account:", err);
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
 * Retrieves captured leads with Supabase as the Single Source of Truth.
 * If a lead is deleted in Supabase, local backup storage is updated automatically.
 */
export async function getCapturedLeads(): Promise<LeadData[]> {
  const leadMap = new Map<string, LeadData>();
  let supabaseSuccess = false;
  const activeSupabaseEmails = new Set<string>();

  // 1. Fetch primary data from Supabase 'leads' table
  try {
    const { data: leadsData, error: leadsErr } = await supabase
      .from("leads" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!leadsErr && Array.isArray(leadsData)) {
      supabaseSuccess = true;
      leadsData.forEach((row: any) => {
        if (row.email) {
          const key = row.email.toLowerCase();
          activeSupabaseEmails.add(key);

          const phoneVal = row.phone || row.phone_number || row.whatsapp_phone || row.mobile || row.whatsapp || "";
          const nameVal = row.name || row.full_name || row.user_name || row.display_name || row.first_name || "";

          let derivAccounts: string[] | undefined = undefined;
          if (Array.isArray(row.deriv_accounts)) {
            derivAccounts = row.deriv_accounts;
          } else if (typeof row.deriv_accounts === "string") {
            try { derivAccounts = JSON.parse(row.deriv_accounts); } catch (e) {}
          }
          if (!derivAccounts && row.deriv_loginid) {
            derivAccounts = [row.deriv_loginid];
          }

          leadMap.set(key, {
            email: row.email,
            phone: phoneVal,
            name: nameVal,
            source: row.source || "tiktok_paid",
            whatsappOptIn: row.whatsapp_opt_in ?? true,
            userId: row.user_id || (row.id ? `usr_${row.id.substring(0, 8)}` : undefined),
            rstate: row.rstate || undefined,
            derivLoginId: row.deriv_loginid || undefined,
            derivAccounts,
            createdAt: row.created_at || new Date().toISOString(),
          });
        }
      });
    }
  } catch (e) {
    console.warn("[Leads] Could not fetch Supabase 'leads' table:", e);
  }

  // 2. Fetch data from Supabase 'profiles' table
  try {
    const { data: profilesData, error: profErr } = await supabase
      .from("profiles" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (!profErr && Array.isArray(profilesData)) {
      supabaseSuccess = true;
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
          activeSupabaseEmails.add(key);
          const existing = leadMap.get(key);

          const phoneVal = row.phone || row.phone_number || row.whatsapp_phone || row.mobile || row.whatsapp || existing?.phone || "";
          const nameVal = row.full_name || row.name || row.user_name || row.display_name || row.first_name || existing?.name || "";

          let profAccounts: string[] | undefined = undefined;
          if (Array.isArray(row.deriv_accounts)) {
            profAccounts = row.deriv_accounts;
          } else if (typeof row.deriv_accounts === "string") {
            try { profAccounts = JSON.parse(row.deriv_accounts); } catch (e) {}
          }
          if (!profAccounts && row.deriv_loginid) {
            profAccounts = [row.deriv_loginid];
          }
          const mergedAccounts = Array.from(new Set([...(existing?.derivAccounts || []), ...(profAccounts || [])]));

          if (existing) {
            leadMap.set(key, {
              ...existing,
              phone: phoneVal || existing.phone,
              name: nameVal || existing.name,
              userId: row.user_id || existing.userId,
              derivLoginId: row.deriv_loginid || existing.derivLoginId,
              derivAccounts: mergedAccounts.length > 0 ? mergedAccounts : existing.derivAccounts,
            });
          } else {
            leadMap.set(key, {
              email: row.email,
              phone: phoneVal,
              name: nameVal,
              source: row.lead_source || "organic_direct",
              whatsappOptIn: row.whatsapp_opt_in ?? true,
              userId: row.user_id || (row.id ? `usr_${row.id.substring(0, 8)}` : undefined),
              derivLoginId: row.deriv_loginid || undefined,
              derivAccounts: mergedAccounts.length > 0 ? mergedAccounts : undefined,
              createdAt: row.created_at || new Date().toISOString(),
            });
          }
        }
      });

      // 3. Proximity matching for shadow profiles
      const leadList = Array.from(leadMap.values());
      const shadowProfiles = Array.from(profilesByDerivId.values());

      leadList.forEach((lead) => {
        if (!lead.derivLoginId && shadowProfiles.length > 0) {
          const leadTime = new Date(lead.createdAt || 0).getTime();
          let closestProfile: any = null;
          let minDiff = Infinity;

          shadowProfiles.forEach((prof) => {
            const profTime = new Date(prof.created_at || 0).getTime();
            const diff = Math.abs(leadTime - profTime);
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

  // 4. Merge from LocalStorage backup to preserve full client properties
  try {
    const rawLocal = localStorage.getItem("digit_bot_captured_leads");
    if (rawLocal) {
      const parsed: LeadData[] = JSON.parse(rawLocal);
      if (Array.isArray(parsed)) {
        parsed.forEach((item) => {
          if (item.email && !item.email.toLowerCase().endsWith("@deriv-user.local")) {
            if (!leadMap.has(item.email.toLowerCase())) {
              leadMap.set(item.email.toLowerCase(), item);
            } else {
              const existing = leadMap.get(item.email.toLowerCase())!;
              leadMap.set(item.email.toLowerCase(), {
                ...item,
                ...existing,
                phone: existing.phone || item.phone,
                name: existing.name || item.name,
                userId: existing.userId || item.userId,
                derivLoginId: existing.derivLoginId || item.derivLoginId,
              });
            }
          }
        });
      }
    }
  } catch (e) {
    console.warn("[Leads] Could not process local storage sync:", e);
  }

  // Filter out any shadow records ending with @deriv-user.local
  const cleanList = Array.from(leadMap.values()).filter(
    (l) => l.email && !l.email.toLowerCase().endsWith("@deriv-user.local")
  );

  return cleanList.sort((a, b) => {
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
