import { FiX, FiShield } from "react-icons/fi";

interface CampusSecurityTurnoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (didTurnOver: boolean) => void;
  onNoClick?: () => void;
}

export default function CampusSecurityTurnoverModal({
  isOpen,
  onClose,
  onConfirm,
  onNoClick,
}: CampusSecurityTurnoverModalProps) {
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
      <div className="bg-white w-full max-w-md rounded-lg p-4.5 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-center mb-6">
          <div className="flex items-center gap-3">
            <FiShield className="text-xl text-navyblue" />
            <h2 className="text-lg font-semibold text-gray-800">
              Campus Security Turnover
            </h2>
          </div>
        </div>

        {/* Question */}
        <div className="mb-6">
          <p className="text-gray-600 text-center text-base leading-relaxed">
            Did you turn over the item to the campus security?
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
            className="flex-1 px-4 py-3 text-white bg-navyblue rounded-md hover:bg-blue-900 transition-colors font-medium"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
