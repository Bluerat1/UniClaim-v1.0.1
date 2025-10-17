import * as React from 'react';

const Badge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'outline' }
>(({ className = '', variant = 'default', ...props }, ref) => {
  const baseClasses = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors';
  const variantClasses = variant === 'outline'
    ? 'border border-gray-300 bg-white text-gray-700'
    : 'bg-gray-100 text-gray-800';

  return (
    <span
      ref={ref}
      className={`${baseClasses} ${variantClasses} ${className}`}
      {...props}
    />
  );
});
Badge.displayName = 'Badge';

export { Badge };
