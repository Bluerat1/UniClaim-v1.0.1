import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

type Props = {
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  hasGeneralError?: boolean;
  autocomplete?: string; // NEW: Add autocomplete prop
};

export default function InputFieldwEyeComp({
  label = "Password",
  value,
  onChange,
  error = "",
  hasGeneralError = false,
  autocomplete, // NEW: Add autocomplete parameter
}: Props) {
  const [showPassword, setShowPassword] = useState(false);

  const inputClass = (hasError: boolean) =>
    `w-full p-2.5 rounded-lg border ${
      hasError
        ? "border-red-500 ring-1 ring-red-400"
        : "border-gray-300 focus:ring-1 focus:ring-black"
    } focus:outline-none`;

  return (
    <div className="mt-4">
      <div className="relative">
        <label className="block text-sm mb-2">{label}</label>
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Enter password"
          value={value}
          onChange={onChange}
          className={`${inputClass(
            !!error || !!hasGeneralError
          )} h-11 text-[15px] pl-4 py-2 pr-12`}
          autoComplete={autocomplete} // NEW: Add autocomplete attribute
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-4 bottom-3 text-black hover:text-black transition-all duration-400"
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeSlashIcon className="size-5" />
          ) : (
            <EyeIcon className="size-5" />
          )}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-3 font-manrope">{error}</p>
      )}
    </div>
  );
}
