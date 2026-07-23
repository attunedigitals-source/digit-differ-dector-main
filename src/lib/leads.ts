import { supabase } from "@/integrations/supabase/client";

export interface LeadData {
  email: string;
  phone: string;
  source: "tiktok_paid" | "organic_direct";
  whatsappOptIn?: boolean;
  name?: string;
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
 * Saves lead details to Supabase table `leads` & `profiles` if available, and backup to localStorage.
 */
export async function submitLead(data: LeadData): Promise<{ success: boolean; message: string }> {
  try {
    const timestamp = new Date().toISOString();
    const leadRecord: LeadData = {
      ...data,
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

    // 2. Insert into Supabase table 'leads' if it exists
    const { error: leadsErr } = await supabase.from("leads" as any).insert({
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
      console.log("[Leads] Lead saved to Supabase 'leads' table:", data.email);
    }

    // 3. Upsert into Supabase table 'profiles' so it shows up in main profiles table
    try {
      await supabase.from("profiles" as any).upsert({
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

    return { success: true, message: "Lead submitted successfully." };
  } catch (err: any) {
    console.error("[Leads] Error submitting lead:", err);
    return { success: true, message: "Lead captured." };
  }
}

/**
 * Links an authenticated Deriv account ID to the registered lead email.
 */
export async function associateDerivAccount(derivLoginId: string, derivAccounts: string[] = []): Promise<void> {
  try {
    if (!derivLoginId) return;

    const lastEmail = localStorage.getItem("last_registered_lead_email");
    const existingLeadsRaw = localStorage.getItem("digit_bot_captured_leads");
    let existingLeads: LeadData[] = existingLeadsRaw ? JSON.parse(existingLeadsRaw) : [];

    if (!Array.isArray(existingLeads)) existingLeads = [];

    // Find lead matching last email or latest lead without a Deriv account
    let targetIndex = -1;
    if (lastEmail) {
      targetIndex = existingLeads.findIndex((l) => l.email.toLowerCase() === lastEmail.toLowerCase());
    }
    if (targetIndex === -1 && existingLeads.length > 0) {
      targetIndex = existingLeads.length - 1;
    }

    let targetEmail: string | undefined;

    if (targetIndex !== -1) {
      existingLeads[targetIndex].derivLoginId = derivLoginId;
      existingLeads[targetIndex].derivAccounts = derivAccounts;
      targetEmail = existingLeads[targetIndex].email;
      localStorage.setItem("digit_bot_captured_leads", JSON.stringify(existingLeads));
      console.log(`[Leads] Associated Deriv account ${derivLoginId} to local lead ${targetEmail}`);
    }

    const emailToUpdate = targetEmail || lastEmail;

    // Update in Supabase leads & profiles if email available
    if (emailToUpdate) {
      await supabase
        .from("leads" as any)
        .update({ deriv_loginid: derivLoginId, deriv_accounts: derivAccounts })
        .eq("email", emailToUpdate);

      await supabase
        .from("profiles" as any)
        .update({ deriv_loginid: derivLoginId, deriv_accounts: derivAccounts })
        .eq("email", emailToUpdate);

      console.log(`[Leads] Updated Deriv account ${derivLoginId} in Supabase for ${emailToUpdate}`);
    }
  } catch (err) {
    console.warn("[Leads] Failed to associate Deriv account to lead:", err);
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

  // 3. Load from Supabase 'profiles' table if phone or lead_source exists
  try {
    const { data: profilesData } = await supabase
      .from("profiles" as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (Array.isArray(profilesData)) {
      profilesData.forEach((row: any) => {
        if (row.email && (row.phone || row.lead_source || row.whatsapp_opt_in)) {
          const key = row.email.toLowerCase();
          const existing = leadMap.get(key);
          leadMap.set(key, {
            email: row.email,
            phone: row.phone || existing?.phone || "",
            name: row.full_name || row.name || existing?.name || "",
            source: row.lead_source || existing?.source || "organic_direct",
            whatsappOptIn: row.whatsapp_opt_in ?? existing?.whatsappOptIn ?? true,
            derivLoginId: row.deriv_loginid || row.id || existing?.derivLoginId,
            derivAccounts: row.deriv_accounts || existing?.derivAccounts,
            createdAt: row.created_at || existing?.createdAt || new Date().toISOString(),
          });
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
