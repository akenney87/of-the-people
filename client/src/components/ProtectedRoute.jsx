// File: client/src/components/ProtectedRoute.jsx
//
// Supabase Auth manages the session via httpOnly storage; we ask the client
// whether a session exists. Returns null while we wait so the navigation
// flicker is brief.
import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function ProtectedRoute() {
  const [authed, setAuthed] = useState(null);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setAuthed(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setAuthed(Boolean(session));
    });

    return () => {
      cancelled = true;
      listener?.subscription?.unsubscribe();
    };
  }, []);

  if (authed === null) {
    return <p className="text-gray-400 text-center pt-24">Loading...</p>;
  }
  return authed ? <Outlet /> : <Navigate to="/login" replace />;
}
