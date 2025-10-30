import type { JSX } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useAdminView } from "../../context/AdminViewContext";
import LoadingSpinner from "../layout/LoadingSpinner";
import { authService } from "../../utils/firebase";
import { useEffect, useState } from "react";

interface EmailVerificationRouteProps {
  children: JSX.Element;
}

export default function EmailVerificationRoute({ children }: EmailVerificationRouteProps) {
  const { isAuthenticated, loading, needsEmailVerification, user } = useAuth();
  const { isViewingAsUser } = useAdminView();
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user && isAuthenticated) {
        try {
          const adminStatus = await authService.isAdmin(user.uid);
          setIsAdmin(adminStatus);
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setIsCheckingAdmin(false);
    };

    checkAdminStatus();
  }, [user, isAuthenticated]);

  if (loading || isCheckingAdmin) {
    return <LoadingSpinner />;
  }

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If user is admin and NOT viewing as user, redirect to admin homepage
  if (isAdmin && !isViewingAsUser) {
    return <Navigate to="/admin" replace />;
  }

  // If user needs email verification, redirect to verification page
  if (needsEmailVerification) {
    return <Navigate to="/email-verification" replace />;
  }

  // User is authenticated and verified (or admin viewing as user), render the protected content
  return children;
}
