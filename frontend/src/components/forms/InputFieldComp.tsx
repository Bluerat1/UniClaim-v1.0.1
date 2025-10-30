type Props = {
  label: string;
  name?: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  inputClass?: (hasError: string) => string;
  showErrorText?: boolean;
  autocomplete?: string;
};

export default function InputFieldComp({
  label,
  name,
  type = "text",
  placeholder,
  value,
  onChange,
  error = "",
  inputClass = (hasError: string) => 
    `w-full rounded-lg border ${hasError ? 'border-red-500' : 'border-gray-300'} focus:ring-2 focus:ring-blue-500 focus:border-transparent`,
  showErrorText = true,
  autocomplete,
}: Props) {
  return (
    <div className="mt-5 relative">
      <label className="block text-sm mb-2">{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        className={`${inputClass(error || '')} h-11 text-md px-4 py-2`}
        value={value}
        onChange={onChange}
        autoComplete={autocomplete}
      />
      {error && showErrorText && (
        <p className="text-xs text-red-500 mt-3 font-manrope">{error}</p>
      )}
    </div>
  );
}
