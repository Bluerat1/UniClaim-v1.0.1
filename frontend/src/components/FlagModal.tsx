import { useState } from "react";

interface FlagModalProps {
  onClose: () => void;
  onSubmit: (reason: string) => void;
  isLoading?: boolean;
}

const FLAG_REASONS = [
  "Inappropriate content",
  "Spam/Fake post",
  "Suspicious activity",
  "Wrong category",
  "Other",
];

export default function FlagModal({
  onClose,
  onSubmit,
  isLoading = false,
}: FlagModalProps) {
  const [selectedReason, setSelectedReason] = useState("");
  const [customReason, setCustomReason] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling up to PostCard
    const reason = selectedReason === "Other" ? customReason : selectedReason;
    if (reason.trim()) {
      onSubmit(reason.trim());
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event from bubbling up to PostCard
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-md p-5 w-full max-w-md mx-4 z-50">
        <h2 className="text-lg font-semibold mb-4">
          Why do you want to flag this post?
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Please select a reason for flagging this post:
        </p>

        <form onSubmit={handleSubmit}>
          <div className="space-y-2 mb-4">
            {FLAG_REASONS.map((reason) => (
              <label
                key={reason}
                className="flex items-center space-x-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="flagReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="text-red-600 focus:ring-red-500"
                />
                <span className="text-sm">{reason}</span>
              </label>
            ))}
          </div>

          {selectedReason === "Other" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Please specify:
              </label>
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Enter your reason..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={3}
                required={selectedReason === "Other"}
              />
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation(); // Prevent event from bubbling up to PostCard
                onClose();
              }}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={(e) => e.stopPropagation()} // Prevent event from bubbling up to PostCard
              disabled={
                !selectedReason ||
                (selectedReason === "Other" && !customReason.trim()) ||
                isLoading
              }
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Flagging..." : "Flag Post"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
