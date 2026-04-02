const requiredSupabaseVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export const env = {
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "",
  supabaseServiceRoleKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
  shopifyWebhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET?.trim() || "",
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "",
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN?.trim() || "",
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || "",
  workerSharedSecret: process.env.WORKER_SHARED_SECRET?.trim() || "",
};

export const hasSupabaseConfig = requiredSupabaseVars.every(
  (key) => Boolean(process.env[key]?.trim()),
);

export const hasWhatsappConfig = Boolean(
  env.whatsappAccessToken && env.whatsappPhoneNumberId,
);

export const isDemoMode = !hasSupabaseConfig;
