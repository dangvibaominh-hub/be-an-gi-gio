import { createClient } from "@supabase/supabase-js";

import { getEnv } from "../config/env.js";

export function createSupabaseServerClient() {
  const env = getEnv();

  if (
    env.SUPABASE_URL === undefined ||
    env.SUPABASE_PUBLISHABLE_KEY === undefined
  ) {
    throw new Error(
      "Missing Supabase config. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, or their NEXT_PUBLIC_* aliases.",
    );
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
