import { FiX, FiUsers } from "react-icons/fi";

interface OSATurnoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (didTurnOver: boolean) => void;
  onNoClick?: () => void;
}

export default function OSATurnoverModal({
  isOpen,
  onClose,
  onConfirm,
  onNoClick,
}: OSATurnoverModalProps) {
  if (!isOpen) return null;

  const handleYes = () => {
    onConfirm(true);
    onClose();
  };

  const handleNo = () => {
    onConfirm(false);
    onNoClick?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white w-full max-w-md rounded-lg p-5 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FiUsers className="text-xl text-blue-500" />
            <h2 className="text-xl font-semibold text-gray-800">
              OSA Turnover
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Question */}
        <div className="mb-6">
          <p className="text-gray-600 text-center text-base leading-relaxed">
            Did you turn over the item to the Office of Student Affairs (OSA)?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleNo}
            className="flex-1 px-4 py-3 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            No
          </button>
          <button
            onClick={handleYes}
            className="flex-1 px-4 py-3 text-white bg-blue-500 rounded-md hover:bg-blue-600 transition-colors font-medium"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
