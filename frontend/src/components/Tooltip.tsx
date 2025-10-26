import type { ReactNode } from 'react';
import clsx from 'clsx';

interface TooltipProps {
  children: ReactNode;
  content: string;
  className?: string;
  tooltipClassName?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function Tooltip({
  children,
  content,
  className = '',
  tooltipClassName = '',
  position = 'top'
}: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div className={clsx('relative group inline-block', className)}>
      {children}
      <div
        className={clsx(
          'absolute whitespace-nowrap z-50 px-3 py-2 text-sm text-white bg-gray-900 rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none',
          'after:content-[""] after:absolute after:border-4 after:border-transparent',
          positionClasses[position],
          tooltipClassName
        )}
      >
        {content}
        {/* Arrow for the tooltip */}
        {position === 'top' && (
          <div className="after:border-t-gray-900 after:top-full after:left-1/2 after:-translate-x-1/2" />
        )}
        {position === 'bottom' && (
          <div className="after:border-b-gray-900 after:bottom-full after:left-1/2 after:-translate-x-1/2" />
        )}
        {position === 'left' && (
          <div className="after:border-l-gray-900 after:left-full after:top-1/2 after:-translate-y-1/2" />
        )}
        {position === 'right' && (
          <div className="after:border-r-gray-900 after:right-full after:top-1/2 after:-translate-y-1/2" />
        )}
      </div>
    </div>
  );
}
