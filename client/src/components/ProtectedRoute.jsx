// File: client/src/components/ProtectedRoute.jsx
//
// Auth cookies are httpOnly so JS can't read them directly. We probe the
// authenticated /api/user endpoint on mount — 200 means we're logged in,
// 401 means we're not. The axios response interceptor will already have
// tried a silent refresh before this resolves to 401.
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import api from "../api";

export default function ProtectedRoute() {
  // null = still checking, true = logged in, false = not logged in
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get("/user")
      .then(() => { if (!cancelled) setAuthed(true); })
      .catch(() => { if (!cancelled) setAuthed(false); });
    return () => { cancelled = true; };
  }, []);

  if (authed === null) {
    return <p className="text-gray-400 text-center pt-24">Loading...</p>;
  }
  return authed ? <Outlet /> : <Navigate to="/login" replace />;
}
