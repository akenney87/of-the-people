// File: client/src/pages/Login.jsx
//
// Sign-in screen, framed as the front page of a paper. Left half is the
// masthead + lede; right half is the form. Fully responsive: collapses
// into a single column on mobile.
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
});

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message || "Login failed. Please check your credentials.");
      setLoading(false);
      return;
    }
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-paper text-ink flex flex-col">
      {/* Dateline strip across the very top */}
      <header className="border-b border-rule">
        <div className="max-w-spread mx-auto px-6 md:px-12 py-3 flex items-center justify-between">
          <span className="eyebrow text-ink-faint">{today}</span>
          <span className="eyebrow text-ink-faint hidden md:inline">
            Vol. I · No. 1 · One Dollar
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-spread w-full mx-auto px-6 md:px-12 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-center">
        {/* Left — masthead + lede */}
        <section className="lg:col-span-7 animate-rise-in">
          <p className="eyebrow text-vermillion mb-6">A Civic-Tech Beta · Gainesville</p>
          <h1
            className="font-display text-[3rem] md:text-hero leading-[0.92] tracking-tight text-ink"
            style={{ fontVariationSettings: '"opsz" 144, "wght" 720, "SOFT" 30' }}
          >
            Of the<br />People.
          </h1>
          <p className="rule mt-8 pt-6 max-w-column font-body text-lede text-ink-soft">
            A simple question with a complicated answer:{" "}
            <span className="text-ink italic">how closely do your elected
            representatives actually represent you?</span>{" "}
            Answer ten questions, see how Andrew Clyde, Jon Ossoff, the
            Hall County Sheriff and your city council voted on what matters
            to you. Then decide what to do about it.
          </p>

          <ol className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-y-6 sm:gap-x-10 max-w-2xl">
            {[
              ['01', 'Answer ten issues, each with a passion weight.'],
              ['02', 'See your alignment score with every rep, from city to Congress.'],
              ['03', 'Officials claim and verify their own positions over time.'],
            ].map(([n, t]) => (
              <li key={n} className="flex flex-col gap-2">
                <span className="folio text-base text-ink-faint">{n}</span>
                <span className="font-body text-caption text-ink-soft leading-snug">{t}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* Right — form */}
        <section className="lg:col-span-5 lg:pl-12 lg:border-l lg:border-rule animate-rise-slow">
          <p className="eyebrow text-ink-soft mb-4">Sign in</p>
          <h2
            className="font-display text-h3 text-ink mb-8 leading-none"
            style={{ fontVariationSettings: '"opsz" 96, "wght" 600' }}
          >
            Returning reader.
          </h2>

          {error && (
            <div className="mb-6 px-4 py-3 border border-vermillion bg-vermillion-soft text-vermillion-deep font-ui text-caption">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="field-label" htmlFor="email">Email</label>
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
            <div>
              <label className="field-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field"
                placeholder="••••••••"
                required
                disabled={loading}
              />
            </div>

            <div className="pt-4">
              <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </div>
          </form>

          <div className="mt-10 pt-6 border-t border-rule-soft flex flex-col gap-3 font-body text-caption text-ink-soft">
            <span>
              Forgot your password?{' '}
              <Link to="/forgot-password" className="text-vermillion hover:text-vermillion-deep underline-offset-4 underline">
                Reset it.
              </Link>
            </span>
            <span>
              New here?{' '}
              <Link to="/register" className="text-vermillion hover:text-vermillion-deep underline-offset-4 underline">
                Create an account.
              </Link>
            </span>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="max-w-spread mx-auto px-6 md:px-12 py-4 flex items-center justify-between">
          <span className="eyebrow text-ink-faint">Of the People — A Non-Profit Beta</span>
          <span className="eyebrow text-ink-faint hidden md:inline">
            Built in Gainesville, Georgia
          </span>
        </div>
      </footer>
    </div>
  );
}
