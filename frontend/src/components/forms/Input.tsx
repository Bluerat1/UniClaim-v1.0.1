import { useState } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

interface GeneralInputProps {
  label?: string;
  labelStyle?: string;
  type?: "text" | "password" | "email";
  name: string;
  value: string;
  placeholder?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  showEyeIcon?: boolean;
  showEyeSlashIcon?: boolean;
  baseStyle?: string;
  errorStyle?: string;
  autocomplete?: string; // NEW: Add autocomplete prop
}

export default function GeneralInputComp({
  label,
  labelStyle = "block mb-1 text-sm font-medium text-gray-700",
  type = "text",
  name,
  value,
  placeholder,
  onChange,
  error,
  showEyeIcon = false,
  showEyeSlashIcon = false,
  baseStyle = "w-full px-4 py-2 h-11 placeholder:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black",
  errorStyle = "border-red-500 focus:ring-red-500",
  autocomplete, // NEW: Add autocomplete parameter
}: GeneralInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  const inputType =
    type === "password" && (showEyeIcon || showEyeSlashIcon)
      ? isVisible
        ? "text"
        : "password"
      : type;

  const showIcon = showEyeIcon && showEyeSlashIcon;

  return (
    <>
      <div className="w-full">
        {label && <label className={labelStyle}>{label}</label>}
        <div className="relative">
          <input
            type={inputType}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className={`${baseStyle} ${error ? errorStyle : ""} ${
              showIcon ? "pr-10" : ""
            }`}
            autoComplete={autocomplete} // NEW: Add autocomplete attribute
          />
          {type === "password" && showIcon && (
            <span
              onClick={() => setIsVisible(!isVisible)}
              className="absolute inset-y-0 right-3 flex items-center cursor-pointer text-gray-500"
            >
              {isVisible ? (
                <EyeSlashIcon className="size-5 text-black" />
              ) : (
                <EyeIcon className="size-5 text-black" />
              )}
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    </>
  );
}
