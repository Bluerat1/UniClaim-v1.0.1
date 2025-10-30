type Props = {
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  inputClass: (hasError: string) => string;
  showErrorText?: boolean; // NEW: Optional toggle for showing error text
};

export default function InputFieldComp({
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  error = "",
  inputClass,
  showErrorText = true, // default to true to preserve previous behavior
}: Props) {
  return (
    <div className="mt-5 relative">
      <label className="block text-sm mb-2">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        className={`${inputClass(error)} h-11 text-md px-4 py-2`}
        value={value}
        onChange={onChange}
      />
      {error && showErrorText && (
        <p className="text-xs text-red-500 mt-3 font-manrope">{error}</p>
      )}
    </div>
  );
}
