/**
 * Brevo Integration Helper
 * Syncs newly registered users to Brevo contact list (List ID 3 by default)
 * for automated email sequences.
 */

export const BREVO_API_KEY =
  (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_BREVO_API_KEY) ||
  (typeof process !== "undefined" && process.env && process.env.VITE_BREVO_API_KEY) ||
  "";

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
 * Includes automatic retry without duplicate SMS if phone number is already registered to another contact.
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

    const apiKey = BREVO_API_KEY || (typeof window !== "undefined" && (window as any).__BREVO_KEY__);
    if (!apiKey) {
      console.warn("[Brevo Notice] VITE_BREVO_API_KEY is not configured.");
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
      attributes.SMS = cleanPhone;
      attributes.PHONE = cleanPhone;
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

      // If SMS is already associated with another contact in Brevo, retry without SMS attribute so email sequence still triggers!
      if (errText.includes("SMS is already associated") && attributes.SMS) {
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
          console.log(`[Brevo] Successfully synced contact ${cleanEmail} (without duplicate SMS) to Brevo List ID ${listIdToUse}`);
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
