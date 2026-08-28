import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

let _client: SupabaseClient<Database> | null = null;

export async function getSupabase(): Promise<SupabaseClient<Database>> {
  if (_client) return _client;

  const { createClient } = await import("@supabase/supabase-js");
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && key) {
    _client = createClient<Database>(url, key, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  } else {
    _client = createClient<Database>("http://localhost", "FAKE_KEY", {
      auth: { persistSession: false },
    });
  }
  return _client;
}
