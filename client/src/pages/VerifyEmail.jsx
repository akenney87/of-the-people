import { useEffect, useState, useRef } from "react"; // Added useRef
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function VerifyEmail() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState("Verifying your email...");
  const [verified, setVerified] = useState(false); // Prevent multiple requests
  const requestCount = useRef(0); // Use useRef instead of state for non-rendering logic

  useEffect(() => {
    // Only proceed if not verified and request hasn't been made (prevent Strict Mode double-calls)
    if (verified || requestCount.current > 0) return;

    requestCount.current = 1; // Increment to prevent further runs (no re-render)

    const verifyUserEmail = async () => {
      try {
        console.log("Sending verification request with token:", token, "(Attempt:", requestCount.current, ")");
        const response = await axios.get(`http://localhost:5000/api/verify/${token}`, {
          headers: { 'Accept': 'application/json' }, // Ensure JSON response
        });

        console.log("Server response:", response.data);
        if (response.status === 200 && response.data.message) {
          setMessage(response.data.message);
          setVerified(true);
        } else if (response.status === 400) {
          const msg = response.data.message;
          if (msg.includes("already verified") || msg.includes("Invalid or expired")) {
            setMessage("⚠️ This verification link has already been used or is expired. Please log in to continue.");
          } else {
            setMessage("⚠️ Unexpected response from server. Redirecting...");
          }
        } else {
          setMessage("⚠️ Unexpected response from server. Redirecting...");
        }

        setTimeout(() => navigate("/login"), 4000);
      } catch (error) {
        console.error("Verification error:", error);
        console.log("Error response:", error.response?.data);

        if (error.response?.status === 400) {
          setMessage("❌ Verification failed. Invalid or expired token. Please log in or request a new verification email.");
        } else if (error.response?.status === 403) {
          setMessage("⚠️ Unauthorized access. Please log in again.");
        } else {
          setMessage("⚠️ An unexpected error occurred. Please try again later.");
        }

        setTimeout(() => navigate("/login"), 4000);
      }
    };

    verifyUserEmail();
  }, [token, navigate, verified]); // Removed requestCount from dependencies (handled by useRef)

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold text-gray-800">{message}</h2>
        {message.includes("expired") && (
          <p className="text-sm text-gray-500 mt-4">
            <a href="/login" className="text-blue-600 hover:text-blue-800 underline">Return to login</a> or 
            <button onClick={() => window.location.href = "/resend-verification"} className="text-blue-600 hover:text-blue-800 underline ml-1">
              resend verification
            </button>.
          </p>
        )}
      </div>
    </div>
  );
}