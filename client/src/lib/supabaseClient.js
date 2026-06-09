// Shared Supabase browser client. Uses @supabase/ssr's createBrowserClient so
// the session lives in a cookie that the SSR helpers + future Vercel API
// routes can also read. There's exactly one of these per page load.
import { createBrowserClient } from "@supabase/ssr";

const url     = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Fail loud during dev so a missing env var doesn't masquerade as a 401.
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy client/.env.example to client/.env.local."
  );
}

export const supabase = createBrowserClient(url, anonKey);
