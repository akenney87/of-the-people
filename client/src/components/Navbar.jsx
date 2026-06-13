// File: src/components/Navbar.jsx
//
// Masthead — the bar at the top of every authed page. Frames the whole app
// as an editorial product. Logotype in Fraunces, dateline + section nav in
// Instrument Sans, hairline rule below.
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { clearOnboardingStash } from '../lib/onboarding';

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
});

const NAV_ITEMS = [
  { to: '/dashboard',       label: 'Issue Feed' },
  { to: '/ballot',          label: 'Your Ballot' },
  { to: '/representatives', label: 'Representatives' },
  { to: '/votes',           label: 'My Votes' },
  { to: '/profile',         label: 'Profile' },
  { to: '/about',           label: 'About' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    clearOnboardingStash();
    await supabase.auth.signOut();
    navigate("/login");
  };

  useEffect(() => {
    const handler = (e) => {
      if (open && menuRef.current && !menuRef.current.contains(e.target)
          && !buttonRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <nav className="fixed top-0 inset-x-0 z-40 bg-paper border-b border-rule">
      <div className="max-w-spread mx-auto px-6 md:px-12 flex items-center justify-between h-16">
        {/* Logotype */}
        <Link to="/dashboard" className="flex items-baseline gap-3 group">
          <span
            className="font-display text-2xl md:text-[1.75rem] tracking-tight text-ink leading-none"
            style={{ fontVariationSettings: '"opsz" 96, "wght" 720, "SOFT" 30' }}
          >
            Of the People
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-7">
          {NAV_ITEMS.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`font-ui text-sm uppercase tracking-eyebrow transition-colors ${
                  active ? 'text-vermillion' : 'text-ink hover:text-vermillion'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="font-ui text-sm uppercase tracking-eyebrow text-ink-soft hover:text-ink transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          ref={buttonRef}
          onClick={() => setOpen(!open)}
          className="lg:hidden p-2 -mr-2 text-ink"
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 16h16" />
          </svg>
        </button>
      </div>

      {/* Dateline strip — visible only on wider screens */}
      <div className="hidden md:flex max-w-spread mx-auto px-6 md:px-12 items-center justify-between border-t border-rule-soft py-1">
        <span className="eyebrow text-ink-faint">{today}</span>
        <span className="eyebrow text-ink-faint whitespace-nowrap">Vol. I · No.&nbsp;1</span>
        <span className="eyebrow text-ink-faint">Gainesville · Hall County · Georgia</span>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div
          ref={menuRef}
          className="lg:hidden bg-paper-warm border-t border-rule-soft animate-ink-fade"
        >
          <div className="max-w-spread mx-auto px-6 py-4 flex flex-col">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="font-ui uppercase tracking-eyebrow text-sm py-3 text-ink hover:text-vermillion border-b border-rule-soft last:border-0"
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => { handleLogout(); setOpen(false); }}
              className="font-ui uppercase tracking-eyebrow text-sm py-3 text-ink-soft hover:text-ink text-left mt-2"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
