import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { authService } from "../../services/firebase/auth";
import { useNavigate } from "react-router-dom";

// Constants
const RESEND_COOLDOWN_DURATION = 30; // seconds

export default function EmailVerification() {
  const { user, userData, logout, handleEmailVerificationComplete } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState("");
  const [isCheckingVerification, setIsCheckingVerification] = useState(false);
  const navigate = useNavigate();

  // Redirect if user is not logged in
  useEffect(() => {
    if (!user || !userData) {
      navigate("/login");
      return;
    }

    // Check if user is admin or campus security (they don't need verification)
    if (userData.role === "admin" || userData.role === "campus_security") {
      navigate("/");
      return;
    }

    // Check if user is already verified
    if (user.emailVerified && userData.emailVerified) {
      navigate("/");
      return;
    }
  }, [user, userData, navigate]);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;

    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (!user || resendCooldown > 0) return;

    try {
      setIsResending(true);
      setResendMessage("");

      await authService.sendEmailVerificationToCurrentUser();
      setResendMessage("Verification email sent! Please check your inbox.");
      setResendCooldown(RESEND_COOLDOWN_DURATION);
    } catch (error: any) {
      setResendMessage(`Failed to send verification email: ${error.message || 'Please try again.'}`);
      console.error("Error sending verification email:", error);
    } finally {
      setIsResending(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const checkEmailVerification = async () => {
    if (!user) return;

    try {
      setIsCheckingVerification(true);

      // Reload the user to get updated email verification status
      await user.reload();

      // If email is now verified, update Firestore and redirect
      if (user.emailVerified) {
        await handleEmailVerificationComplete();
        navigate("/");
      } else {
        setResendMessage(
          "Email not yet verified. Please check your inbox and click the verification link."
        );
      }
    } catch (error: any) {
      console.error("Error checking email verification:", error);
      setResendMessage(`Error checking verification status: ${error.message || 'Please try again.'}`);
    } finally {
      setIsCheckingVerification(false);
    }
  };

  if (!user || !userData) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-8 py-8 px-4 sm:rounded-lg sm:px-10">
          <div className="text-center">
            <div className="mx-auto size-15 text-navyblue">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-albert-sans font-bold text-gray-900">
              Verify Your Email
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              We've sent a verification email to:
            </p>
            <p className="mt-1 text-sm font-medium text-black">{user.email}</p>
          </div>

          <div className="mt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Check Your Email
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      Please check your email inbox and click the verification
                      link to activate your account. You may need to check your
                      spam folder.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button
              onClick={checkEmailVerification}
              disabled={isCheckingVerification}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingVerification
                ? "Checking..."
                : "I've Verified My Email"}
            </button>

            <button
              onClick={handleResendVerification}
              disabled={isResending || resendCooldown > 0}
              className="w-full flex justify-center py-2 px-4 rounded-md text-sm border border-yellow-500 font-medium text-yellow-500 bg-white hover:border-yellow-600 hover:text-yellow-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isResending ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Verification Email"}
            </button>
          </div>

          {resendMessage && (
            <div className="mt-4">
              <div
                className={`p-3 rounded-md text-sm ${
                  resendMessage.includes("sent")
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {resendMessage}
              </div>
            </div>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-black transition-colors duration-300"
            >
              Sign out and use a different account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
