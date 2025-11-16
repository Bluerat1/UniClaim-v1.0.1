import { Link, useNavigate } from "react-router-dom";
import GeneralInputComp from "@/components/forms/Input";
import Header from "../../layout/HeaderComp";
import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  contactNum?: string;
  studentId?: string;
  password?: string;
  confirmPassword?: string;
}

export default function Register() {
  // fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNum, setContactNum] = useState("");
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // for errors
  const [regError, setRegError] = useState<FormErrors>({});

  // Firebase auth and navigation
  const { register, loading } = useAuth();
  const navigate = useNavigate();

  // handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: FormErrors = {};

    if (!firstName.trim()) newErrors.firstName = "First name is required";
    if (!lastName.trim()) newErrors.lastName = "Last name is required";
    if (!email.trim()) newErrors.email = "Email is required";
    else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim()))
        newErrors.email = "Invalid email format";
    }

    if (!contactNum.trim()) newErrors.contactNum = "Contact number is required";
    else if (!/^\d{11}$/.test(contactNum))
      newErrors.contactNum = "Contact number must be 11 digits";

    if (!studentId.trim()) newErrors.studentId = "Student ID is required";
    else if (!/^\d{10}$/.test(studentId.trim()))
      newErrors.studentId = "Student ID must be 10 digits";

    if (!password.trim()) newErrors.password = "Password is required";
    else if (password.length < 8)
      newErrors.password = "Password must be at least 8 characters";

    if (!confirmPassword.trim())
      newErrors.confirmPassword = "This field is required";
    else if (confirmPassword !== password)
      newErrors.confirmPassword = "Passwords do not match";

    setRegError(newErrors);

    if (Object.keys(newErrors).length === 0) {
      try {
        await register(
          email.trim(),
          password,
          firstName.trim(),
          lastName.trim(),
          contactNum.trim(),
          studentId.trim()
        );
        navigate("/"); // Navigate to dashboard after successful registration
      } catch (error: any) {
        // Handle Firebase registration errors
        if (error.message.includes("email-already-in-use")) {
          setRegError({
            email: "An account already exists with this email address.",
          });
        } else {
          setRegError({ email: error.message });
        }
      }
    }
  };

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

  return (
    <>
      <div className="h-screen-fix flex flex-col p-5">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center font-manrope py-15 md:py-15 md:p-0">
          <div className="w-full max-w-sm px-4 space-y-2 text-center">
            <h1 className="text-lg text-blue-900 font-bold text-center">
              User Registration
            </h1>
            <h1 className="text-2xl text-black font-bold text-center sm:text-2xl md:text-3xl">
              Create an account
            </h1>
            <p className="text-sm text-gray-600 text-center">
              Create an account to start using Uniclaim
            </p>
          </div>

          {/* Registration Form */}
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md mt-6 space-y-5 px-4"
          >
            {/* Full Name Fields */}
            <div className="flex flex-col space-y-5 md:space-y-0 md:flex-row md:gap-4">
              <div className="w-full">
                <GeneralInputComp
                  label="First Name"
                  name="firstname"
                  type="text"
                  value={firstName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setFirstName(e.target.value);
                    setRegError((prev) => ({
                      ...prev,
                      firstName: "",
                    }));
                  }}
                  placeholder="Enter your first name"
                  error={regError.firstName}
                  autocomplete="given-name"
                />
              </div>
              <div className="w-full">
                <GeneralInputComp
                  label="Last Name"
                  name="lastname"
                  type="text"
                  value={lastName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setLastName(e.target.value);
                    setRegError((prev) => ({
                      ...prev,
                      lastName: "",
                    }));
                  }}
                  placeholder="Enter your last name"
                  error={regError.lastName}
                  autocomplete="family-name"
                />
              </div>
            </div>

            {/* Email */}
            <GeneralInputComp
              label="Email Address"
              name="email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setEmail(e.target.value);
                setRegError((prev) => ({
                  ...prev,
                  email: "",
                }));
              }}
              placeholder="Enter your email"
              error={regError.email}
              autocomplete="email"
            />

            <GeneralInputComp
              label="Contact Number"
              name="contactNum"
              type="text"
              value={contactNum}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setContactNum(e.target.value);
                setRegError((prev) => ({
                  ...prev,
                  contactNum: "",
                }));
              }}
              placeholder="Enter your contact number"
              error={regError.contactNum}
              autocomplete="tel"
            />

            <GeneralInputComp
              label="Student ID"
              name="studentId"
              type="text"
              numeric
              value={studentId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setStudentId(e.target.value);
                setRegError((prev) => ({
                  ...prev,
                  studentId: "",
                }));
              }}
              placeholder="Enter your student ID (10 digits)"
              error={regError.studentId}
              autocomplete="username"
            />

            {/* Password */}
            <GeneralInputComp
              label="Password"
              name="password"
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setPassword(e.target.value);
                setRegError((prev) => ({
                  ...prev,
                  password: "",
                }));
              }}
              placeholder="Enter your password"
              error={regError.password}
              showEyeIcon={true}
              showEyeSlashIcon={true}
              autocomplete="new-password"
            />

            <GeneralInputComp
              label="Confirm Password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setConfirmPassword(e.target.value);
                setRegError((prev) => ({
                  ...prev,
                  confirmPassword: "",
                }));
              }}
              placeholder="Re-enter your password"
              error={regError.confirmPassword}
              showEyeIcon={true}
              showEyeSlashIcon={true}
              autocomplete="new-password"
            />

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full mt-4 text-white py-2.5 rounded-lg transition-all ${
                loading
                  ? "bg-navyblue cursor-not-allowed"
                  : "bg-blue-900 hover:bg-navyblue"
              }`}
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Creating account...</span>
                </div>
              ) : (
                "Create an account"
              )}
            </button>
          </form>

          <div className="mt-5">
            <h1 className="text-sm text-center">
              Already have an account?{" "}
              <Link to="/login" className="text-blue-900 hover:underline">
                Login Now
              </Link>
            </h1>
          </div>
        </div>
      </div>
    </>
  );
}
