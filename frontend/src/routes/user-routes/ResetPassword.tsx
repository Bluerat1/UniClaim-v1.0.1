import { useState } from "react";
import Header from "../../layout/HeaderComp";
import { Link } from "react-router-dom";
import InputFieldComp from "../../components/InputFieldComp";
import { authService } from "@/services/firebase/auth";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState({ email: "", general: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const newError = { email: "", general: "" };
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      newError.email = "Email is required";
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        newError.email = "Invalid email format";
      }
    }

    setError(newError);

    const isValid = !newError.email;

    if (isValid) {
      try {
        setIsLoading(true);
        await authService.sendPasswordResetEmail(trimmedEmail);
        setIsSuccess(true);
        setEmail("");
      } catch (error: any) {
        setError((prev) => ({ ...prev, general: error.message }));
      } finally {
        setIsLoading(false);
      }
    }
  };

  const inputClass = (hasError: string) =>
    `w-full p-2.5 rounded-lg border ${
      hasError
        ? "border-red-500 ring-1 ring-red-400"
        : "border-gray-300 focus:ring-1 focus:ring-black"
    } focus:outline-none`;

  if (isSuccess) {
    return (
      <>
        <div className="h-screen-fix flex flex-col p-5">
          <Header />
          <div className="flex-1 flex flex-col items-center justify-center font-manrope">
            <div className="w-full max-w-sm px-4 space-y-3">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                  <svg
                    className="h-6 w-6 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h1 className="text-2xl text-black font-bold text-center mb-2">
                  Check Your Email
                </h1>
                <p className="text-sm text-gray-600 text-center mb-4">
                  If an account exists for this email address, you will receive
                  a password reset link shortly.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                  <p className="text-xs text-blue-800 text-center">
                    📧 <strong>Don't see the email?</strong> Check your
                    spam/junk folder. Password reset emails sometimes end up
                    there.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  to="/login"
                  className="block w-full bg-brand hover:bg-yellow-600 text-white text-center py-2 rounded-lg transition-all duration-200"
                >
                  Back to Login
                </Link>

                <button
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail("");
                    setError({ email: "", general: "" });
                  }}
                  className="block w-full border text-center text-brand hover:text-yellow-600 hover:border-yellow-600 py-2 border-brand rounded-lg transition-all duration-200"
                >
                  Try Another Email
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="h-screen-fix flex flex-col p-5">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center font-manrope">
          <div className="w-full max-w-sm px-4 space-y-3">
            <h1 className="text-lg text-brand font-bold text-center">
              Reset Password
            </h1>
            <h1 className="text-3xl text-black font-bold text-center">
              Forgot your password?
            </h1>
            <p className="text-sm text-gray-600 text-center">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>

            <form onSubmit={handleResetPassword}>
              <div className="mt-5">
                <InputFieldComp
                  label="Email"
                  placeholder="Enter your email"
                  value={email}
                  error={error.email || error.general}
                  showErrorText={!!error.email}
                  inputClass={inputClass}
                  autocomplete="email"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setEmail(e.target.value);
                    setError((prev) => ({ ...prev, email: "", general: "" }));
                  }}
                />
              </div>

              {/* General error */}
              {error.general && (
                <p className="text-xs text-red-500 text-center mt-3">
                  {error.general}
                </p>
              )}

              <div className="space-y-5 mt-6">
                <button
                  className={`w-full py-2 text-white rounded-lg transition-all duration-200 ${
                    isLoading
                      ? "bg-gray-400 cursor-not-allowed"
                      : "bg-brand hover:bg-yellow-600 hover:cursor-pointer"
                  }`}
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Sending...</span>
                    </div>
                  ) : (
                    "Send Reset Link"
                  )}
                </button>

                <Link
                  to="/login"
                  className="block w-full border text-center text-brand hover:text-yellow-600 hover:border-yellow-600 py-2 border-brand rounded-lg transition-all duration-200"
                >
                  Back to Login
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
