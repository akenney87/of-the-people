// supabase/functions/claim-email/index.ts
//
// Claim flow Phase 2 — official-email token verification. Two actions on one function:
//
//   { action: "request", rep_id, role }   -> emails a one-time link to representatives.email
//   { action: "verify",  claim, token }   -> validates the token and grants the blue check
//
// Auth: verify_jwt is ON, and we additionally derive the real user id from the JWT (never trust
// the client for identity). The DB functions request_email_claim / verify_email_claim hold all the
// security-critical logic and are callable only by the service role used here.
//
// Secrets used (set in Supabase -> Edge Functions -> Secrets):
//   RESEND_API_KEY   (required)         - your Resend sending key
//   CLAIM_SITE_URL   (optional)         - defaults to https://ofthepeople.vote
//   CLAIM_FROM       (optional)         - defaults to "Of the People <verify@ofthepeople.vote>"
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SITE_URL = Deno.env.get("CLAIM_SITE_URL") ?? "https://ofthepeople.vote";
const FROM = Deno.env.get("CLAIM_FROM") ?? "Of the People <verify@ofthepeople.vote>";
const TTL_MIN = 60;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randToken(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function maskEmail(e: string): string {
  const [u, d] = e.split("@");
  if (!d) return "your email";
  const um = u.length <= 2 ? u[0] + "•" : u.slice(0, 2) + "•".repeat(Math.max(1, u.length - 2));
  return `${um}@${d}`;
}

const prettyName = (name: string) => {
  if (!name) return "your profile";
  const [s, f] = name.split(", ").map((x) => x.trim());
  return f ? `${f} ${s}` : name;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    // Identity comes from the verified JWT, not the body.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "not_authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "request") {
      if (!RESEND_API_KEY) return json({ error: "email_not_configured" }, 500);
      const repId = Number(body.rep_id);
      const role = typeof body.role === "string" ? body.role : "official";
      if (!repId) return json({ error: "bad_request" }, 400);

      const raw = randToken();
      const hash = await sha256hex(raw);
      const { data, error } = await admin.rpc("request_email_claim", {
        p_rep_id: repId,
        p_user_id: user.id,
        p_role: role,
        p_token_hash: hash,
        p_ttl_minutes: TTL_MIN,
      });
      if (error) return json({ error: error.message }, 400);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.send_to) return json({ error: "no_email_on_file" }, 400);

      const name = prettyName(row.rep_name);
      const link = `${SITE_URL}/claim/verify?claim=${row.claim_id}&token=${encodeURIComponent(raw)}`;
      const html =
        `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:520px">
          <p>You (or someone using your account) asked to manage <strong>${name}</strong>'s profile on
          <strong>Of the People</strong>.</p>
          <p>If that was you, confirm you control this email address to unlock editing your positions:</p>
          <p><a href="${link}" style="display:inline-block;background:#c4321a;color:#fff;text-decoration:none;
          padding:12px 20px;border-radius:4px">Verify and claim my profile</a></p>
          <p style="font-size:13px;color:#666">This link expires in ${TTL_MIN} minutes and can be used once.
          If you didn't request this, you can safely ignore this email — nothing changes.</p>
          <p style="font-size:13px;color:#666">Or paste this link into your browser:<br>${link}</p>
        </div>`;
      const text =
        `You asked to manage ${name}'s profile on Of the People.\n\n` +
        `Verify you control this email address and claim the profile:\n${link}\n\n` +
        `This link expires in ${TTL_MIN} minutes and can be used once. ` +
        `If you didn't request this, ignore this email.`;

      const sendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: [row.send_to],
          subject: `Verify your profile on Of the People`,
          html,
          text,
        }),
      });
      if (!sendRes.ok) {
        const detail = await sendRes.text();
        return json({ error: "email_send_failed", detail }, 502);
      }
      return json({ ok: true, sent_to: maskEmail(row.send_to) });
    }

    if (action === "verify") {
      const claimId = Number(body.claim);
      const token = String(body.token ?? "");
      if (!claimId || !token) return json({ error: "bad_request" }, 400);
      const hash = await sha256hex(token);
      const { data, error } = await admin.rpc("verify_email_claim", {
        p_claim_id: claimId,
        p_user_id: user.id,
        p_token_hash: hash,
      });
      if (error) return json({ error: error.message }, 400);
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.ok) return json({ ok: false, reason: row?.reason ?? "unknown" }, 200);
      return json({ ok: true, rep_id: row.rep_id, rep_name: row.rep_name });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
