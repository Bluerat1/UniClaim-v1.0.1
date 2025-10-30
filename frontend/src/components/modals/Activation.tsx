import { useState } from "react";
import { FiX } from "react-icons/fi";
import type { Post } from "@/types/Post";

interface ActivationModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (adminNotes?: string) => void;
  isActivating: boolean;
}

export default function ActivationModal({
  post,
  isOpen,
  onClose,
  onConfirm,
  isActivating,
}: ActivationModalProps) {
  const [adminNotes, setAdminNotes] = useState("");

  if (!isOpen || !post) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm(adminNotes.trim() || undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Activate Post
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close modal"
          >
            <FiX className="size-5 stroke-[1.5px]" />
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <h3 className="font-medium text-gray-900 mb-2">
              {post.title}
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              {post.type === "lost" ? "Lost item report" : "Found item report"} • {post.category}
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <h4 className="font-medium text-blue-900 mb-2 text-sm">
              Activation Notes
            </h4>
            <div className="text-sm text-blue-800 space-y-2">
              <p>
                This post has {post.movedToUnclaimed ? "expired" : "been moved to unclaimed status"} and will be activated with the following changes:
              </p>
              <ul className="list-disc list-inside space-y-1 text-blue-700">
                <li>Moved back to active status</li>
                <li>New 30-day expiration period starts</li>
                <li>Post becomes visible to all users again</li>
                <li>Original poster will be notified</li>
              </ul>
              {post.movedToUnclaimed && (
                <p className="mt-2 font-medium text-blue-900">
                  Note: This post was automatically moved to unclaimed status after 30 days of inactivity.
                </p>
              )}
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="adminNotes" className="block text-sm font-medium text-gray-700 mb-2">
              Admin Notes (Optional)
            </label>
            <textarea
              id="adminNotes"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Add any notes about this activation..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none h-24 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={500}
              disabled={isActivating}
            />
            <p className="text-xs text-gray-500 mt-1">
              {adminNotes.length}/500 characters
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={isActivating}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isActivating}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isActivating ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Activating...
                </>
              ) : (
                "Activate Post"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
