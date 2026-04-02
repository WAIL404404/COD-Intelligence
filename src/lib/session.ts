import { redirect } from "next/navigation";

import { isDemoMode } from "@/lib/env";
import type { AppSession } from "@/lib/domain/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getAppSession(options?: { allowDemo?: boolean }) {
  if (isDemoMode && options?.allowDemo !== false) {
    return {
      mode: "demo",
      userName: "Pilot Demo",
      role: "merchant_admin",
    } satisfies AppSession;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const { data: staff } = await supabase
    .from("internal_staff")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (staff) {
    return {
      mode: "live",
      userId: user.id,
      userName:
        user.user_metadata.full_name || user.email?.split("@")[0] || "Internal Staff",
      email: user.email || "",
      role: "internal_staff",
    } satisfies AppSession;
  }

  const { data: membership } = await supabase
    .from("merchant_memberships")
    .select("merchant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect("/signin");
  }

  return {
    mode: "live",
    userId: user.id,
    userName:
      user.user_metadata.full_name || user.email?.split("@")[0] || "Merchant Admin",
    email: user.email || "",
    role: "merchant_admin",
    merchantId: membership.merchant_id,
  } satisfies AppSession;
}
