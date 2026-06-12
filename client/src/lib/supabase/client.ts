import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { supabaseAuthStorage } from "@/lib/auth/session-storage";

export const supabase =
  env.supabaseUrl && env.supabaseAnonKey
    ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
        auth: {
          storage: supabaseAuthStorage,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;
