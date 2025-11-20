import { useEffect, useState } from "react";
import Header from "../../layout/HeaderComp";
import { useNavigate, Link } from "react-router-dom";
import InputFieldComp from "@/components/forms/InputFieldComp";
import PasswordInput from "@/components/forms/InputFieldWithEye";
import { useAuth } from "@/context/AuthContext";
import { authService } from "@/utils/firebase";
import UserSurvey from "../../assets/user_sruvey.png";
import { LuArrowDown } from "react-icons/lu";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState({ email: "", password: "", general: "" });
  const [checkingAdminStatus, setCheckingAdminStatus] = useState(true);

  const { login, loading, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Check if user is already logged in as admin and redirect them
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (user && isAuthenticated) {
        try {
          const isAdmin = await authService.isAdmin(user.uid);

          // If user is admin, redirect them to admin login page
          if (isAdmin) {
            console.log(
              "Admin detected on user login page - redirecting to admin login"
            );
            navigate("/adminlogin", { replace: true });
            return;
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
        }
      } else {
        setCheckingAdminStatus(false);
      }
    };

    checkAdminStatus();
  }, [user, isAuthenticated, navigate]);

  // fix height for mobile screens
  useEffect(() => {
    const setViewportHeight = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    setViewportHeight();
    window.addEventListener("resize", setViewportHeight);
    return () => window.removeEventListener("resize", setViewportHeight);
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent login if user is already authenticated
    if (isAuthenticated && user) {
      setError((prev) => ({
        ...prev,
        general:
          "You are already logged in. Please logout first if you want to login with a different account.",
      }));
      return;
    }

    const newError = { email: "", password: "", general: "" };
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) newError.email = "Email is required";
    if (!trimmedPassword) newError.password = "Password is required";

    const hasEmptyFields = !trimmedEmail || !trimmedPassword;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!hasEmptyFields) {
      if (!emailRegex.test(trimmedEmail))
        newError.email = "Invalid email format";
      if (trimmedPassword.length < 8)
        newError.password = "Password must be at least 8 characters";
    }

    setError(newError);

    const isValid = !newError.email && !newError.password;

    if (isValid) {
      try {
        await login(trimmedEmail, trimmedPassword);

        // Always redirect to user dashboard - no automatic admin redirect
        // Admin can choose to log in as user if they want to test user features
        navigate("/");
      } catch (error: any) {
        setError((prev) => ({ ...prev, general: error.message }));
      }
    }
  };

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
            <h1 className="text-lg text-blue-900 font-bold text-center">
              User Login
            </h1>
            <h1 className="text-3xl text-black font-bold text-center">
              Log in your account
            </h1>
            <p className="text-sm text-gray-600 text-center">
              Welcome back, it's good to see you again
            </p>

            {/* Loading state while checking admin status */}
            {checkingAdminStatus && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  <span className="text-sm text-gray-600">
                    Checking authentication status...
                  </span>
                </div>
              </div>
            )}

            {/* ✅ Wrap input and button in a <form> to allow Enter key login */}
            <form onSubmit={handleLogin}>
              <div className="mt-5">
                <InputFieldComp
                  label="Email"
                  placeholder="Enter email"
                  value={email}
                  error={error.email || error.general}
                  showErrorText={!!error.email}
                  inputClass={inputClass}
                  autocomplete="email" // NEW: Add email autocomplete
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setEmail(e.target.value);
                    setError((prev) => ({ ...prev, email: "", general: "" }));
                  }}
                />
              </div>

              <PasswordInput
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError((prev) => ({
                    ...prev,
                    password: "",
                    general: "",
                  }));
                }}
                error={error.password}
                hasGeneralError={!!error.general}
                autocomplete="current-password" // NEW: Add current-password autocomplete
              />

              {/* General error */}
              {error.general && (
                <p className="text-xs text-red-500 text-center mt-3">
                  {error.general}
                </p>
              )}

              <div className="flex justify-end">
                <Link
                  to="/reset-password"
                  className="text-manrope my-4 text-sm text-black hover:text-brand hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>

              <div className="space-y-5">
                <button
                  className={`w-full py-2.5 text-white rounded-lg transition-all duration-200 ${
                    loading
                      ? "bg-navyblue cursor-not-allowed"
                      : "bg-blue-900 hover:bg-navyblue hover:cursor-pointer"
                  }`}
                  type="submit"
                  disabled={loading}
                >
                  {loading ? (
                    <div className="flex items-center justify-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Logging in...</span>
                    </div>
                  ) : (
                    "Login"
                  )}
                </button>

                <Link
                  to="/adminlogin"
                  className="block w-full text-center text-white bg-brand hover:bg-yellow-600 py-2.5 rounded-lg"
                >
                  Login as admin
                </Link>
              </div>
            </form>

            <div className="mt-5">
              <h1 className="text-sm text-center">
                Don't have an account?{" "}
                <Link to="/register" className="text-blue-900 hover:underline">
                  Register here
                </Link>
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 mb-5">
          <h1 className="text-sm text-gray-500">More About Us</h1>
          <LuArrowDown className="stroke-[1.5px] text-gray-500 animate-updown duration-500" />
        </div>
      </div>

      <div className=" mb-15">
        <div className="grid grid-cols-1">
          <div className=" space-y-6 lg:space-y-7">
            {/* title text */}
            <h1 className="font-bold font-manrope text-xl text-center lg:text-2xl">
              Download our UniClaim App
            </h1>
            {/* qr code image */}
            <div className="flex items-center justify-center">
              <img
                src={UserSurvey}
                alt="survey_qrcode"
                className="size-45 lg:size-50 hidden"
              />
              <div className="bg-yellow-100 size-45 lg:size-50 rounded-sm flex items-center justify-center">
                <p className="text-sm text-center px-8">
                  UniClaim Mobile App Coming Real Soon
                </p>
              </div>
            </div>
            {/* description */}
            <div className="space-y-3 flex items-center justify-center flex-col px-5">
              <p className="text-sm text-center font-inter w-full md:text-base max-w-lg">
                Scan the qr code or click the link to download the UniClaim app.
              </p>
              <a
                href="https://expo.dev/artifacts/eas/5ACtw9akDgTXyHZ7yeyVUe.apk"
                download
                className="underline text-sm font-medium text-teal-600 cursor-pointer block text-center hover:text-teal-700 transition-colors duration-300"
              >
                Click here to download the app!
              </a>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center">
          <div className="h-0.5 w-full bg-gray-200 rounded-full my-15 mx-5 max-w-3xl"></div>
        </div>

        <div className="grid grid-cols-1">
          <div className=" space-y-6 lg:space-y-7">
            {/* title text */}
            <h1 className="font-bold font-manrope text-xl text-center lg:text-2xl">
              Take Our Survey
            </h1>
            {/* qr code image */}
            <div className="flex items-center justify-center">
              <img
                src={UserSurvey}
                alt="survey_qrcode"
                className="size-45 lg:size-50"
              />
            </div>
            {/* description */}
            <div className="space-y-3 flex items-center justify-center flex-col px-5">
              <p className="text-sm text-center font-inter w-full md:text-base max-w-lg">
                Please tell us what you think about our system by scanning the
                QR code or clicking the link to take the survey.
              </p>
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSdcKHISn8yHb-muHPqEzJkDS4bflXdZm98Mf6T6BWZvVl8xkg/viewform"
                target="_blank"
                className="underline text-sm font-medium text-teal-600 cursor-pointer block text-center hover:text-teal-700 transition-colors duration-300"
              >
                Click Here to Take the Survey
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
