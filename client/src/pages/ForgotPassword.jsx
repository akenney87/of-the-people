// File: src/pages/ForgotPassword.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);   // { type: 'ok' | 'err', text }
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setMessage({ type: 'err', text: error.message || "Error sending reset email." });
    } else {
      setMessage({ type: 'ok', text: "Reset link sent. Check your inbox." });
      setTimeout(() => navigate("/login"), 3500);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="border-b border-rule">
        <div className="max-w-spread mx-auto px-6 md:px-12 py-3 flex items-center justify-between">
          <Link to="/login" className="eyebrow text-ink-faint hover:text-ink">← Back to sign in</Link>
          <span className="eyebrow text-ink-faint hidden md:inline">Account recovery</span>
        </div>
      </header>

      <main className="flex-1 max-w-column w-full mx-auto px-6 md:px-12 py-16 md:py-24 animate-rise-in">
        <p className="eyebrow text-vermillion mb-5">Reset</p>
        <h1
          className="font-display text-h2 leading-[1.02] text-ink mb-6"
          style={{ fontVariationSettings: '"opsz" 96, "wght" 600' }}
        >
          Forgot your password?
        </h1>
        <p className="font-body text-lede text-ink-soft mb-10 border-t border-rule pt-5">
          Type your email and we&apos;ll send a one-time link to set a new one.
          Nothing else changes about your account.
        </p>

        {message && (
          <div
            className={`mb-8 px-4 py-3 border font-ui text-caption ${
              message.type === 'err'
                ? 'border-vermillion bg-vermillion-soft text-vermillion-deep'
                : 'border-navy bg-navy-soft text-navy'
            }`}
          >
            {message.text}
          </div>
        )}

        {!message || message.type === 'err' ? (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label htmlFor="email" className="field-label">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field"
                placeholder="you@somewhere.com"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>
          </form>
        ) : null}

        <p className="mt-10 pt-6 border-t border-rule-soft font-body text-caption text-ink-soft">
          Remembered it?{' '}
          <Link to="/login" className="text-vermillion underline underline-offset-4">Return to sign in.</Link>
        </p>
      </main>
    </div>
  );
}
