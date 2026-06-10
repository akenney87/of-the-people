// File: client/src/pages/Profile.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { clearOnboardingStash } from "../lib/onboarding";

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState({
    email: "",
    street_address: "",
    city: "",
    state: "",
    zip_code: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [addressData, setAddressData] = useState({
    street_address: "",
    city: "",
    state: "",
    zip_code: "",
  });
  const [addressPassword, setAddressPassword] = useState("");
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [updatingEmail, setUpdatingEmail] = useState(false);
  const [updatingAddress, setUpdatingAddress] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        navigate("/login");
        return;
      }
      // RLS limits this to the authed user's own row.
      const { data, error: fetchErr } = await supabase
        .from("users")
        .select("email, city, state, zip_code, county, cong_district, state_senate_dist, state_house_dist")
        .single();
      if (fetchErr || !data) {
        setError("Failed to fetch user data: " + (fetchErr?.message || "no row"));
        setLoading(false);
        return;
      }
      setUser(data);
      setNewEmail(data.email || "");
      setAddressData({
        street_address: "",
        city: data.city || "",
        state: data.state || "",
        zip_code: data.zip_code || "",
      });
      setLoading(false);
    };
    fetchUserData();
  }, [navigate]);

  const handleEmailChangeStart = () => {
    setIsEditingEmail(true);
    setError("");
    setMessage("");
  };

  const handleEmailUpdate = async () => {
    if (updatingEmail) return;
    setUpdatingEmail(true);
    setError("");
    setMessage("");
    // Supabase sends a confirmation email to the NEW address; the address
    // doesn't actually change until the user clicks that link. We don't ask
    // for a password — Supabase enforces ASAL (re-auth required if too old).
    const { error: updErr } = await supabase.auth.updateUser({ email: newEmail });
    if (updErr) {
      setError(updErr.message || "Failed to update email.");
    } else {
      setMessage("Confirmation email sent to the new address. Click the link there to finish.");
      setIsEditingEmail(false);
      setEmailPassword("");
    }
    setUpdatingEmail(false);
  };

  const handleAddressChangeStart = () => {
    setIsEditingAddress(true);
    setError("");
    setMessage("");
    // street_address always starts blank — the server doesn't return it.
    setAddressData({
      street_address: "",
      city: user.city || "",
      state: user.state || "",
      zip_code: user.zip_code || "",
    });
  };

  const handleAddressUpdate = async () => {
    if (updatingAddress) return;
    setUpdatingAddress(true);
    setError("");
    setMessage("");

    // 1) Re-resolve districts. The street_address is sent over the wire to the
    //    Vercel Python function and never written to the DB.
    let districts = null;
    try {
      const res = await fetch("/api/lookup-districts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          street_address: addressData.street_address,
          city: addressData.city,
          state: addressData.state,
          zip_code: addressData.zip_code,
        }),
      });
      if (res.ok) districts = await res.json();
    } catch (lookupErr) {
      console.warn("District lookup failed:", lookupErr);
    }

    // 2) Update the user row. RLS scopes this to the authed user's row.
    const { data: u } = await supabase.auth.getUser();
    const userId = u?.user?.id;
    const patch = {
      city: addressData.city,
      state: addressData.state,
      zip_code: addressData.zip_code,
      ...(districts ? {
        county: districts.county,
        cong_district: districts.cong_district,
        state_senate_dist: districts.state_senate_dist,
        state_house_dist: districts.state_house_dist,
        districts_resolved_at: new Date().toISOString(),
      } : {}),
    };
    const { error: updErr } = await supabase.from("users").update(patch).eq("id", userId);
    if (updErr) {
      setError(updErr.message || "Failed to update address.");
      setUpdatingAddress(false);
      return;
    }

    setMessage(districts
      ? "Address updated and districts re-resolved."
      : "Address updated. District lookup unavailable — your reps list may be stale until next sign-in.");
    setUser({ ...user, ...patch });
    setAddressData({ ...addressData, street_address: "" });
    setIsEditingAddress(false);
    setAddressPassword("");
    setUpdatingAddress(false);
  };

  const handlePasswordChangeStart = () => {
    setIsEditingPassword(true);
    setError("");
    setMessage("");
  };

  const handlePasswordUpdate = async () => {
    if (updatingPassword) return;
    if (passwordData.newPassword !== passwordData.confirmNewPassword) {
      setError("New passwords do not match. Please try again.");
      return;
    }
    setUpdatingPassword(true);
    setError("");
    setMessage("");
    // Supabase enforces ASAL — if the session is too old it will reject this
    // call and the user needs to log in again. We don't pass the old password
    // because Supabase doesn't accept it; the session itself is the proof.
    const { error: updErr } = await supabase.auth.updateUser({ password: passwordData.newPassword });
    if (updErr) {
      setError(updErr.message || "Failed to update password. You may need to log out and back in first.");
    } else {
      setMessage("Password updated successfully.");
      setIsEditingPassword(false);
      setPasswordData({ oldPassword: "", newPassword: "", confirmNewPassword: "" });
    }
    setUpdatingPassword(false);
  };

  const handleLogout = async () => {
    clearOnboardingStash();
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) return <div className="text-center p-4 text-lg text-white">Loading...</div>;

  return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="max-w-lg mx-auto p-8 bg-black rounded-lg shadow-lg mt-0 text-white overflow-hidden">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold">User Profile</h2>
          <Link to="/dashboard" className="text-blue-500 hover:text-blue-700 text-lg font-medium">
            Home
          </Link>
        </div>

        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
        {message && <p className="text-green-500 text-sm text-center mb-4">{message}</p>}

        <div className="mb-8">
          <label className="block text-lg font-medium">Email:</label>
          {!isEditingEmail ? (
            <div className="flex justify-start mt-2">
              <input
                type="text"
                value={user.email}
                disabled
                className="mt-1 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleEmailChangeStart}
                className="px-2 py-1 bg-transparent text-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm font-medium"
              >
                Change Email
              </button>
            </div>
          ) : (
            <>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="mt-2 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter new email"
                disabled={updatingEmail}
              />
              <input
                type="password"
                placeholder="Enter your password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                className="mt-2 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={updatingEmail}
              />
              <div className="mt-4 flex justify-between">
                <button
                  onClick={() => setIsEditingEmail(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-800 text-lg font-medium"
                  disabled={updatingEmail}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEmailUpdate}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-800"
                  disabled={updatingEmail}
                >
                  {updatingEmail ? "Updating..." : "Save Email"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mb-8">
          <label className="block text-lg font-medium">Address:</label>
          {!isEditingAddress ? (
            <div className="space-y-2">
              {/* We store only the district the address resolved to; the street
                  itself is discarded. That's why this card looks different
                  from a typical "edit profile" screen. */}
              <div className="mt-1 px-3 py-2 rounded-md bg-gray-800 text-white text-sm">
                <div>{[user.city, user.state, user.zip_code].filter(Boolean).join(", ")}</div>
                <div className="text-xs text-gray-400 mt-2 space-y-0.5">
                  {user.county && <div>County: {user.county}</div>}
                  {user.cong_district && <div>U.S. Congressional District: {user.cong_district}</div>}
                  {user.state_senate_dist && <div>State Senate District: {user.state_senate_dist}</div>}
                  {user.state_house_dist && <div>State House District: {user.state_house_dist}</div>}
                </div>
                <div className="text-xs text-gray-500 italic mt-3">
                  Your street address isn&apos;t stored — only the districts it resolves to.
                </div>
              </div>
              <button
                onClick={handleAddressChangeStart}
                className="mt-2 ml-0 px-2 py-1 bg-transparent text-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm font-medium"
              >
                Change Address
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                value={addressData.street_address}
                onChange={(e) => setAddressData({ ...addressData, street_address: e.target.value })}
                className="mt-2 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter street address"
                disabled={updatingAddress}
              />
              <input
                type="text"
                value={addressData.city}
                onChange={(e) => setAddressData({ ...addressData, city: e.target.value })}
                className="mt-2 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter city"
                disabled={updatingAddress}
              />
              <input
                type="text"
                value={addressData.state}
                onChange={(e) => setAddressData({ ...addressData, state: e.target.value })}
                className="mt-2 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter state (e.g., GA)"
                disabled={updatingAddress}
              />
              <input
                type="text"
                value={addressData.zip_code}
                onChange={(e) => setAddressData({ ...addressData, zip_code: e.target.value })}
                className="mt-2 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter ZIP"
                disabled={updatingAddress}
              />
              <input
                type="password"
                placeholder="Enter your password"
                value={addressPassword}
                onChange={(e) => setAddressPassword(e.target.value)}
                className="mt-2 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                disabled={updatingAddress}
              />
              <div className="mt-4 flex justify-between">
                <button
                  onClick={() => setIsEditingAddress(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-800 text-lg font-medium"
                  disabled={updatingAddress}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddressUpdate}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-800"
                  disabled={updatingAddress}
                >
                  {updatingAddress ? "Updating..." : "Save Address"}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="mb-8">
          <label className="block text-lg font-medium">Password:</label>
          {!isEditingPassword ? (
            <div className="flex justify-start mt-2">
              <span className="mt-1 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                ********
              </span>
              <button
                onClick={handlePasswordChangeStart}
                className="px-2 py-1 bg-transparent text-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-sm font-medium"
              >
                Change Password
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-4 mt-2">
                <div>
                  <label className="block text-lg font-medium">Current Password:</label>
                  <input
                    type="password"
                    value={passwordData.oldPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, oldPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter current password"
                    disabled={updatingPassword}
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium">New Password:</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Enter new password"
                    disabled={updatingPassword}
                  />
                </div>
                <div>
                  <label className="block text-lg font-medium">Confirm New Password:</label>
                  <input
                    type="password"
                    value={passwordData.confirmNewPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmNewPassword: e.target.value })}
                    className="w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Confirm new password"
                    disabled={updatingPassword}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-between">
                <button
                  onClick={() => setIsEditingPassword(false)}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:bg-gray-800 text-lg font-medium"
                  disabled={updatingPassword}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePasswordUpdate}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-800"
                  disabled={updatingPassword}
                >
                  {updatingPassword ? "Updating..." : "Save Password"}
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="mt-8 w-full px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 text-lg font-medium"
        >
          Logout
        </button>
      </div>
    </div>
  );
}