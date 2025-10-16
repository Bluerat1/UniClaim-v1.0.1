import React, { createContext, useContext, useState, ReactNode } from 'react';

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

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error" | "warning" | "info">("error");
  const [toastDuration, setToastDuration] = useState(4000);

  const showToastMessage = (message: string, type: "success" | "error" | "warning" | "info", duration?: number) => {
    console.log('ToastContext: showToastMessage called with:', message, type, duration);
    setToastMessage(message);
    setToastType(type);

    if (duration === undefined) {
      switch (type) {
        case 'success':
          duration = 3000;
          break;
        case 'error':
          duration = 5000;
          break;
        case 'warning':
          duration = 4000;
          break;
        case 'info':
          duration = 3000;
          break;
        default:
          duration = 4000;
      }
    }

    setToastDuration(duration);
    setShowToast(true);

    // Auto-hide after duration
    setTimeout(() => {
      console.log('ToastContext: Auto-hiding toast');
      setShowToast(false);
    }, duration);
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
