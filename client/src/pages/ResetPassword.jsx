// File: src/pages/ResetPassword.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState(null);  // { type, text }
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'err', text: "The two passwords don't match." });
      return;
    }
    setLoading(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage({ type: 'err', text: error.message || "Could not reset password." });
    } else {
      setMessage({ type: 'ok', text: "New password saved. Taking you back to sign in…" });
      setTimeout(() => navigate("/login"), 3000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="border-b border-rule">
        <div className="max-w-spread mx-auto px-6 md:px-12 py-3 flex items-center justify-between">
          <Link to="/login" className="eyebrow text-ink-faint hover:text-ink">← Sign in</Link>
          <span className="eyebrow text-ink-faint hidden md:inline">Account recovery</span>
        </div>
      </header>

      <main className="flex-1 max-w-column w-full mx-auto px-6 md:px-12 py-16 md:py-24 animate-rise-in">
        <p className="eyebrow text-vermillion mb-5">Reset</p>
        <h1
          className="font-display text-h2 leading-[1.02] text-ink mb-6"
          style={{ fontVariationSettings: '"opsz" 96, "wght" 600' }}
        >
          Choose a new password.
        </h1>
        <p className="font-body text-lede text-ink-soft mb-10 border-t border-rule pt-5">
          You followed the link from your email. Set the new password below
          and you&apos;re back in.
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

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label htmlFor="np" className="field-label">New password</label>
            <input
              id="np"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="field"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="cp" className="field-label">Confirm</label>
            <input
              id="cp"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="field"
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>
          <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
            {loading ? "Saving…" : "Set new password"}
          </button>
        </form>
      </main>
    </div>
  );
}
