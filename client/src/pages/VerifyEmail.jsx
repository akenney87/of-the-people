// File: src/pages/VerifyEmail.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('checking');  // 'checking' | 'ok' | 'fail'

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (cancelled) return;
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error || !data.session) {
        setStatus('fail');
        setTimeout(() => navigate("/login"), 3000);
      } else {
        setStatus('ok');
        setTimeout(() => navigate("/dashboard"), 1500);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="border-b border-rule">
        <div className="max-w-spread mx-auto px-6 md:px-12 py-3 flex items-center justify-between">
          <Link to="/login" className="eyebrow text-ink-faint hover:text-ink">← Sign in</Link>
          <span className="eyebrow text-ink-faint">Email confirmation</span>
        </div>
      </header>

      <main className="flex-1 max-w-column w-full mx-auto px-6 md:px-12 py-24 text-center animate-rise-in">
        <p className="eyebrow text-vermillion mb-6">Verifying</p>
        <h1
          className="font-display text-h2 leading-tight text-ink"
          style={{ fontVariationSettings: '"opsz" 96, "wght" 600' }}
        >
          {status === 'checking' && 'Confirming your email…'}
          {status === 'ok' && 'You\'re in.'}
          {status === 'fail' && 'This link can\'t be verified.'}
        </h1>
        <p className="mt-6 font-body text-lede text-ink-soft">
          {status === 'checking' && 'Just a moment.'}
          {status === 'ok' && 'Taking you to your dashboard.'}
          {status === 'fail' && 'The link may be expired or already used. Returning to sign-in.'}
        </p>
      </main>
    </div>
  );
}
