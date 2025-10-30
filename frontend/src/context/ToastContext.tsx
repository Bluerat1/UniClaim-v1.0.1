import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import ToastItem from "@/components/common/ToastItem";
import Toast from "@/components/common/Toast";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration: number;
}

interface ToastContextType {
  showToast: (
    type: ToastType,
    title: string,
    description?: string,
    duration?: number
  ) => void;
  position?: "top-right" | "bottom-left" | "bottom-right";
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({
  children,
  position = "top-right",
}: {
  children: ReactNode;
  position?: "top-right" | "bottom-left" | "bottom-right";
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ✅ Generate always-unique toast ID
  const generateId = () =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const showToast = useCallback(
    (
      type: ToastType,
      title: string,
      description?: string,
      duration: number = 3000
    ) => {
      // ✅ deduplication check
      const isDuplicate = toasts.some(
        (t) =>
          t.type === type && t.title === title && t.description === description
      );

      if (isDuplicate) return;

      const id = generateId();
      const newToast: Toast = { id, type, title, description, duration };

      // add toast to stack
      setToasts((prev) => [...prev, newToast]);

      // auto-remove after duration
      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, duration);
    },
    [toasts]
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // ✅ Toast container position
  const containerPosition =
    position === "bottom-left"
      ? "bottom-5 left-5 flex-col-reverse"
      : position === "bottom-right"
      ? "bottom-5 right-5 flex-col-reverse"
      : "top-5 right-5"; // top-right

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className={`fixed ${containerPosition} z-[60] flex flex-col gap-y-3 pointer-events-none px-4
    ${position === "bottom-left" ? "items-start" : "items-end"}`}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto w-full max-w-[90%] sm:max-w-sm md:max-w-md"
          >
            <ToastItem {...toast} onClose={() => removeToast(toast.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};
