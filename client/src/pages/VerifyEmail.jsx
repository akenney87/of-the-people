// File: src/pages/VerifyEmail.jsx
//
// Supabase Auth handles verification: the link in the confirmation email
// resolves to this URL with `#access_token=...&type=signup` in the hash, and
// createBrowserClient picks it up to create the session. We just need to wait
// a beat for that processing, then bounce the user to /dashboard.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    let cancelled = false;
    // Small delay so supabase-js can ingest the URL hash on mount.
    const timer = setTimeout(async () => {
      if (cancelled) return;
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        setMessage("This verification link has already been used or is expired. Please log in.");
        setTimeout(() => navigate("/login"), 3000);
        return;
      }
      setMessage("Email verified. Taking you to your dashboard...");
      setTimeout(() => navigate("/dashboard"), 1500);
    }, 500);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold text-gray-800">{message}</h2>
      </div>
    </div>
  );
}
