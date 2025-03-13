// File: src/pages/ForgotPassword.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api"; // Import the custom API utility

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      console.log("Submitting forgot password request for:", email);
      const response = await api.post("/forgot-password", { email }); // Use api.js
      setMessage(response.data.message);
      setTimeout(() => navigate("/login"), 3000);
    } catch (error) {
      console.error("Forgot password failed:", error.response?.data?.message || error.message);
      setMessage(error.response?.data?.message || "Error sending reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Forgot Password</h2>
        {message && (
          <p className={`${message.includes("Error") ? "text-red-500" : "text-green-500"} text-sm mb-4 text-center`}>
            {message}
          </p>
        )}
        {!message && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder="Enter your email"
                required
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Send Reset Email"}
            </button>
          </form>
        )}
        <p className="text-sm text-gray-600 text-center mt-4">
          Return to{" "}
          <a href="/login" className="text-blue-600 hover:text-blue-800 underline">
            Login
          </a>
        </p>
      </div>
    </div>
  );
}