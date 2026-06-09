// File: client/src/pages/Login.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import TouchButton from '../components/TouchButton';

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
    <div className="bg-background font-sf h-screen w-screen m-0 p-0 flex items-center justify-center overflow-hidden">
      <div className="bg-background p-xl rounded-lg shadow-lg w-card text-text-primary">
        <h2 className="text-3xl font-bold mb-xl text-center">Login</h2>
        {error && <p className="text-error text-message mb-xl text-center">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-xl">
          <div className="text-center">
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-sm px-md py-sm w-input-wide bg-input-gray text-text-primary placeholder-text-placeholder rounded-lg border border-text-primary focus:outline-none focus:ring-2 focus:ring-link-primary text-sm"
              placeholder="Enter your email"
              required
              disabled={loading}
            />
          </div>
          <div className="text-center">
            <label className="block text-sm font-medium">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-sm px-md py-sm w-input-wide bg-input-gray text-text-primary placeholder-text-placeholder rounded-lg border border-text-primary focus:outline-none focus:ring-2 focus:ring-link-primary text-sm"
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>
          <div className="flex justify-center">
            <TouchButton 
              onClick={(e) => {
                // Prevent default to avoid form submission twice
                e.preventDefault();
                handleSubmit(e);
              }} 
              disabled={loading}
              variant="primary"
            >
              {loading ? "Signing In..." : "Sign In"}
            </TouchButton>
          </div>
          <p className="text-sm text-center mt-xl">
            Forgot password?{" "}
            <Link to="/forgot-password" className="text-link-primary hover:text-link-hover">
              Reset here
            </Link>
          </p>
          <p className="text-sm text-center mt-xxs">
            Don&apos;t have an account?{" "}
            <Link to="/register" className="text-link-primary hover:text-link-hover">
              Create Account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}