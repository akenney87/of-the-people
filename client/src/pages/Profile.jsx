// File: client/src/pages/Profile.jsx
//
// Profile page — clean editorial layout. Three sections, each a "card":
// account summary (read-only), credentials (email + password), address
// (with the discard-policy note).
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { clearOnboardingStash } from "../lib/onboarding";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);                  // { type, text }
  const [edit, setEdit] = useState(null);                // 'email' | 'address' | 'password' | null

  const [emailDraft, setEmailDraft] = useState("");
  const [addrDraft, setAddrDraft] = useState({ street_address: "", city: "", state: "", zip_code: "" });
  const [pwDraft, setPwDraft] = useState({ newPassword: "", confirmNewPassword: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) { navigate("/login"); return; }
      const { data, error: e } = await supabase.from("users")
        .select("email, city, state, zip_code, county, cong_district, state_senate_dist, state_house_dist, districts_resolved_at")
        .single();
      if (e || !data) { setMsg({ type: 'err', text: "Couldn't load your profile." }); setLoading(false); return; }
      setUser(data);
      setEmailDraft(data.email || "");
      setAddrDraft({ street_address: "", city: data.city || "", state: data.state || "", zip_code: data.zip_code || "" });
      setLoading(false);
    })();
  }, [navigate]);

  const startEdit = (k) => { setEdit(k); setMsg(null); };
  const cancelEdit = () => {
    setEdit(null); setMsg(null);
    setEmailDraft(user.email || "");
    setAddrDraft({ street_address: "", city: user.city || "", state: user.state || "", zip_code: user.zip_code || "" });
    setPwDraft({ newPassword: "", confirmNewPassword: "" });
  };

  const saveEmail = async () => {
    if (busy) return; setBusy(true); setMsg(null);
    const { error: e } = await supabase.auth.updateUser({ email: emailDraft });
    if (e) setMsg({ type: 'err', text: e.message || 'Could not update email.' });
    else { setMsg({ type: 'ok', text: 'Confirmation email sent to the new address.' }); setEdit(null); }
    setBusy(false);
  };

  const saveAddress = async () => {
    if (busy) return; setBusy(true); setMsg(null);
    let districts = null;
    try {
      const res = await fetch("/api/lookup-districts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          street_address: addrDraft.street_address,
          city: addrDraft.city, state: addrDraft.state, zip_code: addrDraft.zip_code,
        }),
      });
      if (res.ok) districts = await res.json();
    } catch (err) { console.warn(err); }

    const { data: u } = await supabase.auth.getUser();
    const patch = {
      city: addrDraft.city, state: addrDraft.state, zip_code: addrDraft.zip_code,
      ...(districts ? {
        county: districts.county,
        cong_district:          districts.cong_district,
        state_senate_dist:      districts.state_senate_dist,
        state_house_dist:       districts.state_house_dist,
        county_commission_dist: districts.county_commission_dist,
        city_council_dist:      districts.city_council_dist,
        school_board_dist:      districts.school_board_dist,
        districts_resolved_at:  new Date().toISOString(),
      } : {}),
    };
    const { error: e } = await supabase.from("users").update(patch).eq("id", u?.user?.id);
    if (e) setMsg({ type: 'err', text: e.message || "Couldn't save address." });
    else {
      setMsg({ type: 'ok', text: districts ? 'Address updated and districts re-resolved.' : 'Address updated. District lookup unavailable — refresh later.' });
      setUser({ ...user, ...patch });
      setAddrDraft({ ...addrDraft, street_address: "" });
      setEdit(null);
    }
    setBusy(false);
  };

  const savePassword = async () => {
    if (busy) return;
    if (pwDraft.newPassword !== pwDraft.confirmNewPassword) {
      setMsg({ type: 'err', text: "Passwords don't match." }); return;
    }
    if (pwDraft.newPassword.length < 8) {
      setMsg({ type: 'err', text: "Password must be at least 8 characters." }); return;
    }
    setBusy(true); setMsg(null);
    const { error: e } = await supabase.auth.updateUser({ password: pwDraft.newPassword });
    if (e) setMsg({ type: 'err', text: e.message || 'Could not update password.' });
    else {
      setMsg({ type: 'ok', text: 'Password updated.' });
      setPwDraft({ newPassword: "", confirmNewPassword: "" });
      setEdit(null);
    }
    setBusy(false);
  };

  const handleLogout = async () => {
    clearOnboardingStash();
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return <div className="max-w-spread mx-auto"><p className="eyebrow text-ink-faint">Setting the type…</p></div>;
  }

  return (
    <div className="max-w-spread mx-auto animate-rise-in">
      <header className="border-b-2 border-ink pb-6">
        <p className="eyebrow text-vermillion">Account</p>
        <h1
          className="font-display text-[2.5rem] md:text-h1 leading-[0.95] mt-3 text-ink"
          style={{ fontVariationSettings: '"opsz" 144, "wght" 600, "SOFT" 30' }}
        >
          Your profile.
        </h1>
        <p className="font-body text-lede text-ink-soft mt-4 max-w-3xl">
          Where you live (sort of), what you sign in with, and what you can
          change. Your street address is never stored — only the districts
          it resolves to.
        </p>
      </header>

      {msg && (
        <div className={`mt-6 px-4 py-3 border font-ui text-caption ${
          msg.type === 'err'
            ? 'border-vermillion bg-vermillion-soft text-vermillion-deep'
            : 'border-navy bg-navy-soft text-navy'
        }`}>
          {msg.text}
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* District summary */}
        <section className="lg:col-span-7 card">
          <p className="eyebrow text-ink-soft mb-2">Where you vote</p>
          <h2
            className="font-display text-h3 leading-tight text-ink"
            style={{ fontVariationSettings: '"opsz" 96, "wght" 500' }}
          >
            {user.city ? `${user.city}, ${user.state}` : 'Address incomplete'}
            {user.zip_code && <span className="font-mono text-ink-soft"> · {user.zip_code}</span>}
          </h2>

          <dl className="mt-8 grid grid-cols-2 gap-y-5 gap-x-8 font-mono text-base">
            <Fact label="County">{user.county || '—'}</Fact>
            <Fact label="US Congressional">{user.cong_district || '—'}</Fact>
            <Fact label="GA State Senate">{user.state_senate_dist || '—'}</Fact>
            <Fact label="GA State House">{user.state_house_dist || '—'}</Fact>
          </dl>

          <p className="mt-8 pt-4 border-t border-rule-soft text-caption text-ink-faint italic">
            We geocode your street once and discard it. Only what you see
            above is in the database.
          </p>

          {edit !== 'address' ? (
            <div className="mt-6">
              <button onClick={() => startEdit('address')} className="btn-secondary">
                Update address
              </button>
            </div>
          ) : (
            <div className="mt-8 border-t border-rule pt-6 space-y-6">
              <p className="eyebrow text-ink-soft">Type your address again — we&apos;ll re-resolve districts and discard the street.</p>
              <div>
                <label className="field-label">Street</label>
                <input type="text" className="field" value={addrDraft.street_address}
                  onChange={(e) => setAddrDraft({...addrDraft, street_address: e.target.value})}
                  placeholder="123 Green St SW" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div className="col-span-2">
                  <label className="field-label">City</label>
                  <input type="text" className="field" value={addrDraft.city}
                    onChange={(e) => setAddrDraft({...addrDraft, city: e.target.value})} />
                </div>
                <div>
                  <label className="field-label">State</label>
                  <select className="field" value={addrDraft.state}
                    onChange={(e) => setAddrDraft({...addrDraft, state: e.target.value})}>
                    <option value="GA">GA</option>
                  </select>
                </div>
                <div>
                  <label className="field-label">ZIP</label>
                  <input type="text" className="field font-mono tabular-nums" value={addrDraft.zip_code}
                    onChange={(e) => setAddrDraft({...addrDraft, zip_code: e.target.value})} />
                </div>
              </div>
              <div className="flex items-center gap-4 pt-4 border-t border-rule-soft">
                <button onClick={saveAddress} className="btn-primary" disabled={busy}>
                  {busy ? 'Resolving…' : 'Save address'}
                </button>
                <button onClick={cancelEdit} className="btn-ghost">Cancel</button>
              </div>
            </div>
          )}
        </section>

        {/* Credentials */}
        <section className="lg:col-span-5 card">
          <p className="eyebrow text-ink-soft mb-2">Credentials</p>
          <h2
            className="font-display text-h4 text-ink"
            style={{ fontVariationSettings: '"opsz" 60, "wght" 500' }}
          >
            How you sign in.
          </h2>

          <div className="mt-7 border-t border-rule-soft pt-5">
            <p className="eyebrow text-ink-faint">Email</p>
            {edit !== 'email' ? (
              <div className="flex items-center justify-between gap-4 mt-1">
                <span className="font-mono text-sm text-ink break-all">{user.email}</span>
                <button onClick={() => startEdit('email')} className="btn-ghost shrink-0">Change</button>
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <input type="email" className="field" value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)} placeholder="new@somewhere.com" />
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={saveEmail} className="btn-primary" disabled={busy}>
                    {busy ? 'Sending…' : 'Send confirmation'}
                  </button>
                  <button onClick={cancelEdit} className="btn-ghost">Cancel</button>
                </div>
                <p className="font-body text-caption text-ink-faint italic pt-2">
                  Supabase will send a confirmation email to the new address.
                </p>
              </div>
            )}
          </div>

          <div className="mt-7 border-t border-rule-soft pt-5">
            <p className="eyebrow text-ink-faint">Password</p>
            {edit !== 'password' ? (
              <div className="flex items-center justify-between gap-4 mt-1">
                <span className="font-mono text-sm text-ink">••••••••</span>
                <button onClick={() => startEdit('password')} className="btn-ghost shrink-0">Change</button>
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                <input type="password" className="field" value={pwDraft.newPassword}
                  onChange={(e) => setPwDraft({...pwDraft, newPassword: e.target.value})}
                  placeholder="At least 8 characters" />
                <input type="password" className="field" value={pwDraft.confirmNewPassword}
                  onChange={(e) => setPwDraft({...pwDraft, confirmNewPassword: e.target.value})}
                  placeholder="Confirm" />
                <div className="flex items-center gap-3 pt-2">
                  <button onClick={savePassword} className="btn-primary" disabled={busy}>
                    {busy ? 'Saving…' : 'Set new password'}
                  </button>
                  <button onClick={cancelEdit} className="btn-ghost">Cancel</button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-10 pt-5 border-t border-rule">
            <button onClick={handleLogout} className="btn-secondary border-vermillion text-vermillion hover:bg-vermillion hover:text-paper w-full justify-center">
              Sign out
            </button>
          </div>
        </section>
      </div>

      <div className="mt-10 text-center">
        <Link to="/dashboard" className="eyebrow text-ink-soft hover:text-vermillion">
          ← Back to the issue feed
        </Link>
      </div>
    </div>
  );
}

function Fact({ label, children }) {
  return (
    <div>
      <dt className="eyebrow text-ink-faint">{label}</dt>
      <dd className="text-ink tabular-nums text-lg mt-1">{children}</dd>
    </div>
  );
}
