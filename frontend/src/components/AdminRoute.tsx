import type { JSX } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

interface AdminRouteProps {
  children: JSX.Element;
}

export default function AdminRoute({ children }: AdminRouteProps) {
  const { isAuthenticated, loading, userData } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  // Check if user is authenticated and has admin role
  if (!isAuthenticated) {
    return <Navigate to="/adminlogin" replace />;
  }

  if (userData?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}
