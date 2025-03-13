// File: src/pages/ResetPassword.jsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api"; // Import the custom API utility

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match. Please try again.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      console.log("Submitting password reset for token:", token);
      const response = await api.post("/reset-password", { token, newPassword }); // Use api.js
      setMessage(response.data.message);
      setTimeout(() => navigate("/login"), 3000);
    } catch (error) {
      console.error("Password reset failed:", error.response?.data?.message || error.message);
      setMessage(error.response?.data?.message || "Error resetting password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Reset Password</h2>
        {message ? (
          message.includes("Error") ? (
            <p className="text-red-500 text-sm mb-4 text-center">{message}</p>
          ) : (
            <div className="text-center">
              <p className="text-green-500 text-2xl font-bold mb-4">{message}</p>
              <p className="text-sm text-gray-600">
                If you’re not redirected,{' '}
                <a href="/login" className="text-blue-600 hover:text-blue-800 underline">
                  click here to return to login
                </a>.
              </p>
            </div>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter your new password"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Confirm your new password"
                required
                disabled={loading}
              />
            </div>
            {message && message.includes("Error") && (
              <p className="text-red-500 text-sm mb-4 text-center">{message}</p>
            )}
            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </form>
        )}
        {!message && (
          <p className="text-sm text-gray-600 text-center mt-4">
            Return to{' '}
            <a href="/login" className="text-blue-600 hover:text-blue-800 underline">
              Login
            </a>
          </p>
        )}
      </div>
    </div>
  );
}