// File: client/src/pages/Profile.jsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api"; // Import the custom API utility

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
      try {
        const accessToken = localStorage.getItem("accessToken"); // Updated to accessToken
        if (!accessToken) {
          navigate("/login");
          return;
        }
        const response = await api.get("/user"); // Use api.js, no manual headers needed
        console.log("Fetched user data:", response.data); // Debug log
        setUser(response.data);
        setNewEmail(response.data.email);
        setAddressData({
          street_address: response.data.street_address,
          city: response.data.city,
          state: response.data.state,
          zip_code: response.data.zip_code,
        });
      } catch (err) {
        setError("Failed to fetch user data: " + (err.response?.data?.message || err.message));
        console.error("Fetch user error:", err.response?.data || err);
        setTimeout(() => navigate("/login"), 3000);
      } finally {
        setLoading(false);
      }
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
    try {
      await api.put("/user", { email: newEmail, password: emailPassword }); // Use api.js
      setMessage("Email updated successfully.");
      setUser({ ...user, email: newEmail });
      setIsEditingEmail(false);
      setEmailPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update email. Please check your password and try again.");
      console.error("Update email error:", err.response?.data || err);
    } finally {
      setUpdatingEmail(false);
    }
  };

  const handleAddressChangeStart = () => {
    setIsEditingAddress(true);
    setError("");
    setMessage("");
    setAddressData({
      street_address: user.street_address,
      city: user.city,
      state: user.state,
      zip_code: user.zip_code,
    });
  };

  const handleAddressUpdate = async () => {
    if (updatingAddress) return;
    setUpdatingAddress(true);
    setError("");
    setMessage("");
    try {
      await api.put("/user/address", {
        street_address: addressData.street_address,
        city: addressData.city,
        state: addressData.state,
        zip_code: addressData.zip_code,
        password: addressPassword,
      }); // Use api.js
      setMessage("Address updated successfully.");
      setUser({
        ...user,
        street_address: addressData.street_address,
        city: addressData.city,
        state: addressData.state,
        zip_code: addressData.zip_code,
      });
      setIsEditingAddress(false);
      setAddressPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update address. Please check your password and try again.");
      console.error("Update address error:", err.response?.data || err);
    } finally {
      setUpdatingAddress(false);
    }
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
    try {
      await api.put("/user/password", {
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword,
      }); // Use api.js
      setMessage("Password updated successfully.");
      setIsEditingPassword(false);
      setPasswordData({ oldPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update password. Please try again.");
      console.error("Update password error:", err.response?.data || err);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken"); // Clear accessToken
    localStorage.removeItem("refreshToken"); // Clear refreshToken
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
              <input
                type="text"
                value={user.street_address}
                disabled
                className="mt-1 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={user.city}
                disabled
                className="mt-1 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={user.state}
                disabled
                className="mt-1 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={user.zip_code}
                disabled
                className="mt-1 block w-full px-3 py-2 rounded-md bg-gray-800 text-white shadow-sm sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                placeholder="Enter state (e.g., NY)"
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