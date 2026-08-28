import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env
  .PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : createClient("http://localhost", "FAKE_KEY", {
        auth: { persistSession: false },
      });

// if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
//   throw new Error(
//     "Faltan las variables de entorno PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_PUBLISHABLE_KEY (.env)",
//   );
// }

// export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
//   auth: {
//     persistSession: true,
//     autoRefreshToken: true,
//   },
// });
