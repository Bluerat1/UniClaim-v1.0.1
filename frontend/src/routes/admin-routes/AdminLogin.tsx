import Header from "../../layout/HeaderComp";
import EmailInputField from "../../../src/components/forms/InputFieldComp";
import PasswordInput from "../../../src/components/forms/InputFieldWithEye";
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authService } from "../../../src/utils/firebase";

export default function AdminLogin() {
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState({
    adminEmail: "",
    adminPassword: "",
    adminGeneral: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  //height vh fit
  useEffect(() => {
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    setViewportHeight();
    window.addEventListener("resize", setViewportHeight);

    return () => {
      window.removeEventListener("resize", setViewportHeight);
    };
  }, []);

  // Removed automatic admin redirect - admin must manually login
  // This prevents auto-login when admin visits admin login page

  //error handling here
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const newError = { adminEmail: "", adminPassword: "", adminGeneral: "" };
    const trimmedAdminEmail = adminEmail.trim();
    const trimmedAdminPassword = adminPassword.trim();

    //check of empty inputs
    if (!trimmedAdminEmail) newError.adminEmail = "Email is required";
    if (!trimmedAdminPassword) newError.adminPassword = "Password is required";

    // e check niya if tinood ba na walay inputs ang email og password
    const hasEmptyFields = !trimmedAdminEmail || !trimmedAdminPassword;

    // dari na dayun tong mga error handling based kung unsay sulod sa input fields
    // error para sa email and password formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!hasEmptyFields) {
      if (!emailRegex.test(trimmedAdminEmail))
        newError.adminEmail = "Invalid email format";

      if (trimmedAdminPassword.length < 8)
        newError.adminPassword = "Password must be at least 8 characters";
    }

    // gamiton ang mga errors
    setAdminError(newError);

    const isValid = !newError.adminEmail && !newError.adminPassword;

    if (isValid) {
      try {
        setIsLoading(true);

        // Use real Firebase authentication with admin check
        await authService.login(trimmedAdminEmail, trimmedAdminPassword, true);
        
        // If we get here, the user is an admin and was successfully logged in
        navigate("/admin");
      } catch (error: any) {
        setAdminError((prev) => ({
          ...prev,
          adminGeneral:
            error.message || "Login failed. Please check your credentials.",
        }));
      } finally {
        setIsLoading(false);
      }
    }
  };

  //error and no error styling
  const inputClass = (hasError: string) =>
    `w-full p-2.5 rounded-lg border ${
      hasError
        ? "border-red-500 ring-1 ring-red-400"
        : "border-gray-300 focus:ring-1 focus:ring-black"
    } focus:outline-none`;

  return (
    <>
      <div className="h-screen-fix flex flex-col p-5">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center font-manrope">
          <div className="w-full max-w-sm px-4 space-y-3">
            <h1 className="text-lg text-brand font-bold text-center">
              Admin Login
            </h1>
            <h1 className="text-3xl text-black font-bold text-center">
              Log in your account
            </h1>
            <p className="text-sm text-gray-600 text-center">
              Welcome back, it’s good to see you again
            </p>

            {/* Wrap inputs and button in a form for Enter key support */}
            <form onSubmit={handleLogin}>
              {/* Email and password fields */}
              <div>
                {/* Email InputField*/}
                <div className="mt-5">
                  <EmailInputField
                    label="Email"
                    placeholder="Enter email"
                    value={adminEmail}
                    error={adminError.adminEmail || adminError.adminGeneral} // still passes the style error
                    showErrorText={!!adminError.adminEmail} // only shows text if email-specific error exists
                    inputClass={inputClass}
                    autocomplete="email"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setAdminEmail(e.target.value);
                      setAdminError((prev) => ({
                        ...prev,
                        email: "",
                        general: "",
                      }));
                    }}
                  />
                </div>

                {/* Password */}
                <PasswordInput
                  value={adminPassword}
                  onChange={(e) => {
                    setAdminPassword(e.target.value);
                    setAdminError((prev) => ({
                      ...prev,
                      password: "",
                      general: "",
                    }));
                  }}
                  error={adminError.adminPassword}
                  hasGeneralError={!!adminError.adminGeneral}
                  autocomplete="current-password"
                />
              </div>

              {/* General error */}
              {adminError.adminGeneral && (
                <p className="text-xs text-red-500 text-center mt-3">
                  {adminError.adminGeneral}
                </p>
              )}

              <div className="space-y-4 mt-8">
                {/* submit button */}
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
                      <span>Logging in...</span>
                    </div>
                  ) : (
                    "Login"
                  )}
                </button>

                <Link
                  to="/login"
                  className="block w-full border text-center text-brand hover:text-yellow-600 hover:border-yellow-600 py-2 border-brand rounded-lg"
                >
                  Login as user
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
