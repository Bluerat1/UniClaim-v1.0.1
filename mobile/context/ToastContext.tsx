import React, { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';

interface ToastContextType {
  showToast: boolean;
  toastMessage: string;
  toastType: "success" | "error" | "warning" | "info";
  toastDuration: number;
  setShowToast: (show: boolean) => void;
  setToastMessage: (message: string) => void;
  setToastType: (type: "success" | "error" | "warning" | "info") => void;
  setToastDuration: (duration: number) => void;
  showToastMessage: (message: string, type: "success" | "error" | "warning" | "info", duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Default durations for different toast types
const DEFAULT_TOAST_DURATIONS = {
  success: 3000,
  error: 5000,
  warning: 4000,
  info: 3000,
} as const;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "warning" | "info">("success");
  const [toastDuration, setToastDurationState] = useState<number>(DEFAULT_TOAST_DURATIONS.success);
  
  // Wrapper function to ensure type safety
  const setToastDuration = (duration: number) => {
    setToastDurationState(duration);
  };
  
  // Keep track of the timeout ID to clear it if a new toast is shown
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const showToastMessage = (
    message: string, 
    type: "success" | "error" | "warning" | "info" = 'success', 
    duration?: number
  ) => {
    console.log('ToastContext: showToastMessage called with:', { message, type, duration });
    
    // Clear any existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Set the toast content
    setToastMessage(message);
    setToastType(type);
    
    // Set duration based on type if not provided
    const toastDuration = duration ?? DEFAULT_TOAST_DURATIONS[type];
    setToastDuration(toastDuration);
    
    // Show the toast
    setShowToast(true);
    
    // Set timeout to hide the toast
    timeoutRef.current = setTimeout(() => {
      console.log('ToastContext: Auto-hiding toast');
      setShowToast(false);
      timeoutRef.current = null;
    }, toastDuration);
  };

  return (
    <ToastContext.Provider
      value={{
        showToast,
        toastMessage,
        toastType,
        toastDuration,
        setShowToast,
        setToastMessage,
        setToastType,
setToastDuration,
        showToastMessage,
      }}
    >
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};
