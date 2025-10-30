import type { FC } from "react";
import {
  FiCheckCircle,
  FiXCircle,
  FiAlertTriangle,
  FiInfo,
  FiX,
} from "react-icons/fi";
import clsx from "clsx";

interface ToastItemProps {
  title: string;
  description?: string;
  type: "success" | "error" | "warning" | "info";
  onClose: () => void;
}

const ToastItem: FC<ToastItemProps> = ({
  title,
  description,
  type,
  onClose,
}) => {
  const iconMap = {
    success: <FiCheckCircle className="text-green-200 text-xl" />,
    error: <FiXCircle className="text-red-200 text-xl" />,
    warning: <FiAlertTriangle className="text-yellow-100 text-xl" />,
    info: <FiInfo className="text-blue-100 text-xl" />,
  };

  const styleMap = {
    success: "bg-green-600 text-white",
    error: "bg-red-600 text-white",
    warning: "bg-yellow-500 text-black",
    info: "bg-blue-600 text-white",
  };
  return (
    <>
      <div
        className={clsx(
          "relative flex items-start gap-3 p-3 rounded shadow w-full transition-all transform ease-out duration-300 translate-y-0",
          styleMap[type]
        )}
      >
        <div className="mt-1 size-6">{iconMap[type]}</div>
        <div className="flex flex-col flex-1">
          <p className="font-medium text-sm">{title}</p>
          {description && <p className="text-xs mt-1">{description}</p>}
        </div>
        <button
          onClick={onClose}
          className="absolute top-1.5 right-2 p-1 text-white hover:text-white"
          aria-label="Close"
        >
          <FiX />
        </button>
      </div>
    </>
  );
};

export default ToastItem;
