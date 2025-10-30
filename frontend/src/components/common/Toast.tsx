import { useEffect, useState } from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
}

export default function Toast({ message, onClose }: ToastProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
    const timeout = setTimeout(() => {
      setShow(false);
      setTimeout(onClose, 300); // after animation
    }, 3000);

    return () => clearTimeout(timeout);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-2 rounded text-white text-sm transition-all duration-300 transform
        ${show ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}
        bg-gray-800
      `}
    >
      {message}
    </div>
  );
}
