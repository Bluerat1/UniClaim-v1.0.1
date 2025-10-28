import type { JSX } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";

interface ProtectedRouteProps {
  children: JSX.Element;
  requireEmailVerification?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  requireEmailVerification = true 
}: ProtectedRouteProps) {
  const { isAuthenticated, loading, user, userData } = useAuth();
  const location = useLocation();

  if (loading || (isAuthenticated && !userData)) {
    return <LoadingSpinner />;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If email verification is required and user is not verified, redirect to verification page
  // Skip this check for the verification page itself to prevent infinite redirects
  if (requireEmailVerification && 
      user && 
      !user.emailVerified && 
      location.pathname !== '/verify-email') {
    return <Navigate to="/verify-email" state={{ from: location }} replace />;
  }

  return children;
}
