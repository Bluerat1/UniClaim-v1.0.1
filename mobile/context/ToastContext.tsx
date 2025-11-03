import React, { createContext, useContext, useState, ReactNode, useRef, useEffect, useCallback } from 'react';
import Toast from '../components/Toast';

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

// Track if we're currently showing a toast
let isToastShowing = false;

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
        timeoutRef.current = null;
        isToastShowing = false;
      }
    };
  }, []);

  const showToastMessage = React.useCallback((
    message: string, 
    type: "success" | "error" | "warning" | "info" = 'success', 
    duration?: number
  ) => {
    console.log('ToastContext: showToastMessage called with:', { message, type, duration, isToastShowing });
    
    // If a toast is already showing, don't show another one
    if (isToastShowing) {
      console.log('ToastContext: Toast already showing, ignoring duplicate');
      return;
    }
    
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
    isToastShowing = true;
    setShowToast(true);
    
    console.log('ToastContext: Showing toast with message:', message);
    
    // Set timeout to hide the toast
    timeoutRef.current = setTimeout(() => {
      console.log('ToastContext: Auto-hiding toast');
      isToastShowing = false;
      setShowToast(false);
      timeoutRef.current = null;
    }, toastDuration);
  }, []);
  
  // Handle toast hide animation complete
  const handleToastHide = React.useCallback(() => {
    isToastShowing = false;
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = React.useMemo(() => ({
    showToast,
    toastMessage,
    toastType,
    toastDuration,
    setShowToast: (show: boolean) => {
      console.log('ToastContext: setShowToast called with:', show);
      setShowToast(show);
      if (!show) {
        isToastShowing = false;
      }
    },
    setToastMessage,
    setToastType,
    setToastDuration,
    showToastMessage,
  }), [showToast, toastMessage, toastType, toastDuration, showToastMessage]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Render the Toast component here to ensure it's only in the tree once */}
      <Toast
        visible={showToast}
        message={toastMessage}
        type={toastType}
        onClose={() => {
          console.log('ToastContext: onClose called');
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          isToastShowing = false;
          setShowToast(false);
        }}
        onAnimationEnd={handleToastHide}
        duration={toastDuration}
      />
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
