import { useState } from "react";
import { FiX, FiInfo, FiPackage, FiShield, FiUser } from "react-icons/fi";
import CampusSecurityTurnoverModal from "./CampusSecurityTurnover";
import OSATurnoverModal from "./OSATurnover";

interface FoundActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancel: () => void; // New prop for proper cancel handling
  onActionSelect: (
    action: "keep" | "turnover to OSA" | "turnover to Campus Security"
  ) => void;
  selectedAction?: "keep" | "turnover to OSA" | "turnover to Campus Security";
  onResetSelection?: () => void;
}

export default function FoundActionModal({
  isOpen,
  onClose,
  onCancel,
  onActionSelect,
  selectedAction,
  onResetSelection,
}: FoundActionModalProps) {
  const [showTurnoverConfirmation, setShowTurnoverConfirmation] = useState(false);
  const [showOSATurnoverConfirmation, setShowOSATurnoverConfirmation] = useState(false);

  if (!isOpen) return null;

  const actions = [
    "keep",
    "turnover to OSA",
    "turnover to Campus Security",
  ] as const;

  const handleActionSelect = (action: (typeof actions)[number]) => {
    if (action === "turnover to Campus Security") {
      setShowTurnoverConfirmation(true);
      // Don't call onActionSelect here, wait for confirmation
    } else if (action === "turnover to OSA") {
      setShowOSATurnoverConfirmation(true);
      // Don't call onActionSelect here, wait for confirmation
    } else {
      // For "keep" action, update immediately
      onActionSelect(action);
      onClose();
    }
  };

  const handleTurnoverConfirmation = async (didTurnOver: boolean) => {
    setShowTurnoverConfirmation(false);
    
    if (didTurnOver) {
      // Update the parent component's state with the selected action
      onActionSelect("turnover to Campus Security");
      // Close the main modal after a small delay to ensure state updates
      setTimeout(() => {
        onClose();
      }, 100);
    } else {
      // If they selected "No", reset the selection
      onResetSelection?.();
      // The main modal stays open for them to choose another option
    }
  };

  const handleOSATurnoverConfirmation = (didTurnOver: boolean) => {
    setShowOSATurnoverConfirmation(false);
    
    if (didTurnOver) {
      // Update the parent component's state with the selected action
      onActionSelect("turnover to OSA");
      // Close the main modal after a small delay to ensure state updates
      setTimeout(() => {
        onClose();
      }, 100);
    } else {
      // If they selected "No", reset the selection
      onResetSelection?.();
      // The main modal stays open for them to choose another option
    }
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

        {/* Action Buttons with Descriptions */}
        <div className="space-y-4">
          <div 
            onClick={() => handleActionSelect("keep")}
            className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
              selectedAction === "keep" 
                ? "border-brand bg-brand/5" 
                : "border-gray-200 hover:border-brand/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${
                selectedAction === "keep" 
                  ? "bg-brand/10 text-brand" 
                  : "bg-gray-100 text-gray-500"
              }`}>
                <FiUser className="text-lg" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Keep Item</h3>
                <p className="text-sm text-gray-500 mt-1">
                  You will keep the item and handle returning it to the owner yourself. Choose this if you can easily identify the owner.
                </p>
              </div>
            </div>
          </div>

          <div 
            onClick={() => handleActionSelect("turnover to OSA")}
            className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
              selectedAction === "turnover to OSA" 
                ? "border-brand bg-brand/5" 
                : "border-gray-200 hover:border-brand/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${
                selectedAction === "turnover to OSA" 
                  ? "bg-brand/10 text-brand" 
                  : "bg-gray-100 text-gray-500"
              }`}>
                <FiShield className="text-lg" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Turnover to OSA</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Give the item to the school office. They will keep it safe and help find the owner. The office is open during school hours.
                </p>
              </div>
            </div>
          </div>

          <div 
            onClick={() => handleActionSelect("turnover to Campus Security")}
            className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
              selectedAction === "turnover to Campus Security" 
                ? "border-brand bg-brand/5" 
                : "border-gray-200 hover:border-brand/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${
                selectedAction === "turnover to Campus Security" 
                  ? "bg-brand/10 text-brand" 
                  : "bg-gray-100 text-gray-500"
              }`}>
                <FiPackage className="text-lg" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Turnover to Campus Security</h3>
                <p className="text-sm text-gray-500 mt-1">
                  For important items or when found at night. The school guards will keep it safe. Use this for valuable items or when the office is closed.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campus Security Turnover Confirmation Modal */}
      <CampusSecurityTurnoverModal
        isOpen={showTurnoverConfirmation}
        onClose={() => {
          setShowTurnoverConfirmation(false);
          onResetSelection?.();
        }}
        onConfirm={handleTurnoverConfirmation}
      />

      {/* OSA Turnover Confirmation Modal */}
      <OSATurnoverModal
        isOpen={showOSATurnoverConfirmation}
        onClose={() => setShowOSATurnoverConfirmation(false)}
        onConfirm={handleOSATurnoverConfirmation}
        onNoClick={onResetSelection}
      />
    </div>
  );
}
