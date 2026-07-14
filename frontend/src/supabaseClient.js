import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Null until VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are set (build-time
// env vars, so this only takes effect on the next deploy after they're
// added). Callers check for null and show a "not configured yet" state
// rather than crashing.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
