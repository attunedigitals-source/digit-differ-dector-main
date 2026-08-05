import { supabase } from "@/integrations/supabase/client";

export type PromoScope = "trial_only" | "paid_only" | "all" | "specific_user";

export interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  scope: PromoScope;
  specific_user_email?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
  times_used: number;
  is_active: boolean;
  created_at: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  discountPercent?: number;
  code?: string;
  promoId?: string;
}

/**
 * Validates a promo code against database rules and user eligibility.
 */
export async function validatePromoCode(
  inputCode: string,
  user: { id: string; email?: string } | null,
  profile: any
): Promise<ValidationResult> {
  const cleanCode = inputCode.trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, message: "Please enter a promo code." };
  }

  try {
    // 1. Fetch code from Supabase
    const { data: promo, error } = await supabase
      .from("promo_codes" as any)
      .select("*")
      .ilike("code", cleanCode)
      .maybeSingle();

    let targetPromo: any = promo;

    // Fallback: If table is missing or code is PRO20 and not yet saved in DB
    if (!targetPromo && cleanCode === "PRO20") {
      targetPromo = {
        id: "default-pro20",
        code: "PRO20",
        discount_percent: 20,
        scope: "trial_only",
        is_active: true,
        times_used: 0,
      };
    }

    if (error && error.code !== "PGRST116" && !targetPromo) {
      console.warn("[Promo Validation] Supabase fetch notice:", error);
    }

    if (!targetPromo) {
      return { valid: false, message: `Promo code "${cleanCode}" is invalid.` };
    }

    if (!targetPromo.is_active) {
      return { valid: false, message: `Promo code "${cleanCode}" is no longer active.` };
    }

    // Expiration Check
    if (targetPromo.expires_at) {
      const expiry = new Date(targetPromo.expires_at).getTime();
      if (expiry < Date.now()) {
        return { valid: false, message: `Promo code "${cleanCode}" has expired.` };
      }
    }

    // Usage Limit Check
    if (targetPromo.max_uses != null && targetPromo.times_used >= targetPromo.max_uses) {
      return { valid: false, message: `Promo code "${cleanCode}" has reached its maximum usage limit.` };
    }

    // Scope & Eligibility Checks
    const hasEverPaid = Boolean(profile?.has_ever_paid || profile?.subscription_status === 'active');
    const isPaidActive = profile?.subscription_status === 'active';

    if (targetPromo.scope === "trial_only") {
      // First-time trial users ONLY. Cannot be an existing paid user or have paid in past.
      if (hasEverPaid || isPaidActive) {
        return { 
          valid: false, 
          message: `Code "${cleanCode}" (20% off) is restricted to first-time trial users only.` 
        };
      }
    } else if (targetPromo.scope === "paid_only") {
      if (!hasEverPaid && !isPaidActive) {
        return { 
          valid: false, 
          message: `Code "${cleanCode}" is valid for existing paid members only.` 
        };
      }
    } else if (targetPromo.scope === "specific_user") {
      const userEmail = user?.email || profile?.email || "";
      if (!targetPromo.specific_user_email || targetPromo.specific_user_email.toLowerCase() !== userEmail.toLowerCase()) {
        return { 
          valid: false, 
          message: `Code "${cleanCode}" is not eligible for your user account.` 
        };
      }
    }

    return {
      valid: true,
      code: targetPromo.code,
      discountPercent: targetPromo.discount_percent,
      promoId: targetPromo.id,
      message: `${targetPromo.discount_percent}% discount applied!`
    };

  } catch (err: any) {
    console.error("[Promo Validation Error]:", err);
    // Graceful fallback for PRO20
    if (cleanCode === "PRO20") {
      const hasEverPaid = Boolean(profile?.has_ever_paid || profile?.subscription_status === 'active');
      if (hasEverPaid) {
        return { valid: false, message: 'Code "PRO20" is restricted to first-time trial users.' };
      }
      return { valid: true, code: "PRO20", discountPercent: 20, message: "20% trial discount applied!" };
    }
    return { valid: false, message: err.message || "Failed to validate promo code." };
  }
}

/**
 * Increments usage count of a promo code when payment is completed.
 */
export async function incrementPromoCodeUses(code: string) {
  try {
    const { data } = await supabase
      .from("promo_codes" as any)
      .select("id, times_used")
      .ilike("code", code)
      .maybeSingle();

    if (data) {
      await supabase
        .from("promo_codes" as any)
        .update({ times_used: (data.times_used || 0) + 1 })
        .eq("id", data.id);
    }
  } catch (err) {
    console.warn("[Promo Increment Notice]:", err);
  }
}

/**
 * Admin: Fetch all promo codes
 */
export async function getAdminPromoCodes(): Promise<PromoCode[]> {
  const { data, error } = await supabase
    .from("promo_codes" as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[Admin Promo Fetch Notice]:", error);
    return [
      {
        id: "default-pro20",
        code: "PRO20",
        discount_percent: 20,
        scope: "trial_only",
        is_active: true,
        times_used: 0,
        created_at: new Date().toISOString()
      }
    ];
  }
  return data || [];
}

/**
 * Admin: Create a new promo code
 */
export async function createAdminPromoCode(payload: {
  code: string;
  discount_percent: number;
  scope: PromoScope;
  specific_user_email?: string | null;
  expires_at?: string | null;
  max_uses?: number | null;
}): Promise<PromoCode> {
  const cleanCode = payload.code.trim().toUpperCase();
  const { data, error } = await supabase
    .from("promo_codes" as any)
    .insert({
      code: cleanCode,
      discount_percent: payload.discount_percent,
      scope: payload.scope,
      specific_user_email: payload.specific_user_email || null,
      expires_at: payload.expires_at || null,
      max_uses: payload.max_uses ? Number(payload.max_uses) : null,
      is_active: true,
      times_used: 0
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Admin: Toggle active state of promo code
 */
export async function toggleAdminPromoCode(id: string, is_active: boolean) {
  const { error } = await supabase
    .from("promo_codes" as any)
    .update({ is_active })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Admin: Delete promo code
 */
export async function deleteAdminPromoCode(id: string) {
  const { error } = await supabase
    .from("promo_codes" as any)
    .delete()
    .eq("id", id);

  if (error) throw error;
}
