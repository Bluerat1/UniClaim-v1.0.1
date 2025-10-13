import { FiX, FiShield, FiCheckCircle, FiXCircle } from "react-icons/fi";

interface AdminCampusSecurityTurnoverModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (status: "collected" | "not_available", notes?: string) => void;
  post?: any;
  allowedActions?: ("collected" | "not_available")[];
}

export default function AdminCampusSecurityTurnoverModal({
  isOpen,
  onClose,
  onConfirm,
  post,
  allowedActions = ["collected", "not_available"],
}: AdminCampusSecurityTurnoverModalProps) {
  if (!isOpen) return null;

  const handleConfirm = (status: "collected" | "not_available") => {
    onConfirm(status);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white w-full max-w-lg rounded-lg p-6 shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FiShield className="text-xl text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-800">
              Campus Security Collection Confirmation
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Item Details */}
        {post && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Item Details:</h3>
            <p className="text-gray-600">
              <span className="font-medium">Title:</span> {post.title}
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Category:</span> {post.category}
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Location:</span> {post.location}
            </p>
          </div>
        )}

        {/* Question */}
        <div className="mb-6">
          <p className="text-gray-600 text-center text-lg leading-relaxed mb-4">
            Confirm the status of item collection from Campus Security:
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-4">
          {allowedActions.includes("not_available") && (
            <button
              onClick={() => handleConfirm("not_available")}
              className="flex-1 px-4 py-3 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <FiXCircle className="text-lg" />
              Item Not Available
            </button>
          )}
          {allowedActions.includes("collected") && (
            <button
              onClick={() => handleConfirm("collected")}
              className="flex-1 px-4 py-3 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <FiCheckCircle className="text-lg" />
              Item Collected
            </button>
          )}
        </div>

        {/* Additional Info */}
        <div className="text-sm text-gray-500 text-center">
          <p>
            • If item is collected, ownership will transfer to System
            Administrator
          </p>
          <p>
            • If item is not available, the post will be deleted from the system
          </p>
        </div>
      </div>
    </div>
  );
}
