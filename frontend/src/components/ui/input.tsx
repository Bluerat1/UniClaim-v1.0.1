import * as React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  numeric?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type = 'text', numeric, onChange, ...props }, ref) => {
    const handleNumericInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (numeric) {
        // Remove any non-numeric characters
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
      }
      onChange?.(e);
    };

    const inputType = numeric ? 'text' : type;
    const inputMode = numeric ? 'numeric' : undefined;
    const pattern = numeric ? '[0-9]*' : undefined;

    return (
      <input
        type={inputType}
        inputMode={inputMode}
        pattern={pattern}
        className={`flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        ref={ref}
        onChange={numeric ? handleNumericInput : onChange}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
