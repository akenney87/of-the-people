// File: client/src/components/ProtectedRoute.jsx
import { Navigate, Outlet } from "react-router-dom";

export default function ProtectedRoute() {
  const accessToken = localStorage.getItem("accessToken"); // Check for accessToken instead of token
  console.log("ProtectedRoute check - Access Token:", accessToken); // Debug log to verify token presence

  return accessToken ? <Outlet /> : <Navigate to="/login" replace />;
}