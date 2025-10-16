import { FiUsers } from "react-icons/fi";

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
      <div className="bg-white w-full max-w-md rounded-lg p-4.5">
        {/* Header */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-3">
            <FiUsers className="text-xl text-navyblue" />
            <h2 className="text-lg font-semibold text-gray-800">
              OSA Turnover
            </h2>
          </div>
        </div>

        {/* Question */}
        <div className="mb-6">
          <p className="text-gray-600 text-center text-base leading-relaxed">
            Did you turn over the item to the Office of Student Affairs (OSA)
            before creating a post or report?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleNo}
            className="flex-1 px-4 py-3 text-sm md:text-base text-gray-700 bg-gray-100 rounded-md hover:bg-gray-300 transition-colors font-medium"
          >
            No, not yet
          </button>
          <button
            onClick={handleYes}
            className="flex-1 px-4 py-3 text-sm md:text-base text-white bg-navyblue rounded-md hover:bg-dark-navyblue transition-colors font-medium"
          >
            Yes, I turned it over
          </button>
        </div>
      </div>
    </div>
  );
}
