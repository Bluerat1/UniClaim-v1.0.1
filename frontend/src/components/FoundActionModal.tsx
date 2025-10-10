import { FiX, FiInfo } from "react-icons/fi";

interface FoundActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel: () => void; // New prop for proper cancel handling
  onActionSelect: (
    action: "keep" | "turnover to OSA" | "turnover to Campus Security"
  ) => void;
  selectedAction?: "keep" | "turnover to OSA" | "turnover to Campus Security";
}

export default function FoundActionModal({
  isOpen,
  onClose,
  onCancel,
  onActionSelect,
  selectedAction,
}: FoundActionModalProps) {
  if (!isOpen) return null;

  const actions = [
    "keep",
    "turnover to OSA",
    "turnover to Campus Security",
  ] as const;

  const handleActionSelect = (action: (typeof actions)[number]) => {
    onActionSelect(action);
    onClose();
  };

  // const handleBackdropClick = (e: React.MouseEvent) => {
  //   if (e.target === e.currentTarget) {
  //     onCancel();
  //   }
  // };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white w-full max-w-md rounded-lg p-6 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FiInfo className="text-xl text-gray-600" />
            <h2 className="text-xl font-semibold text-gray-800">
              Keep or Turnover
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Description */}
        <p className="text-gray-600 text-center mb-6 leading-relaxed">
          Will you keep the item and return it yourself, or turn it over to
          Campus Security or OSA?
        </p>

        {/* Action Buttons */}
        <div className="space-y-3">
          {actions.map((action) => (
            <button
              key={action}
              onClick={() => handleActionSelect(action)}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                selectedAction === action
                  ? "bg-brand text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm"
              }`}
            >
              {action.charAt(0).toUpperCase() + action.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
