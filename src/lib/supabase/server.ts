import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

type SupabaseServerClientOptions = {
  allowCookieWrites?: boolean;
};

export async function createSupabaseServerClient(
  options: SupabaseServerClientOptions = {},
) {
  const cookieStore = await cookies();
  const allowCookieWrites = options.allowCookieWrites ?? false;

  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        if (!allowCookieWrites) {
          return;
        }

        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}
