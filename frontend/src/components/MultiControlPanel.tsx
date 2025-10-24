import React from "react";

interface MultiControlPanelProps {
  // View mode state and handler
  viewMode: "card" | "list";
  onViewModeChange: (mode: "card" | "list") => void;

  // Selection state and handlers
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;

  // Action handlers
  onBulkDelete?: () => void;
  isBulkDeleting?: boolean;

  // Bulk revert handlers
  onBulkRevert?: () => void;
  isBulkReverting?: boolean;

  // Bulk restore handlers
  onBulkRestore?: () => void;
  isBulkRestoring?: boolean;

  // View type for conditional rendering
  viewType?: string;

  // Additional custom actions (for flagged posts page)
  customActions?: React.ReactNode;

  // Styling
  className?: string;
}

export default function MultiControlPanel({
  viewMode,
  onViewModeChange,
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkDelete,
  isBulkDeleting = false,
  onBulkRevert,
  isBulkReverting = false,
  onBulkRestore,
  isBulkRestoring = false,
  viewType,
  customActions,
  className = "",
}: MultiControlPanelProps) {
  const isAllSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className={`flex items-center justify-end ${className}`}>
      <div className="flex items-center gap-2 bg-white rounded-md border border-gray-200 px-3 py-2 w-auto">
        {/* View Mode Toggle */}
        <button
          onClick={() =>
            onViewModeChange(viewMode === "card" ? "list" : "card")
          }
          className={`p-1.5 rounded transition-colors ${
            viewMode === "card"
              ? "text-blue-600 hover:bg-blue-50"
              : "text-gray-600 hover:bg-gray-50"
          }`}
          title={`Switch to ${viewMode === "card" ? "list" : "card"} view`}
        >
          {viewMode === "card" ? (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
              />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>

        {/* Select All/Deselect All Icon Button */}
        <button
          onClick={onSelectAll}
          className={`p-1.5 rounded transition-colors ${
            isAllSelected
              ? "text-blue-600 hover:bg-blue-50"
              : "text-gray-600 hover:bg-gray-50"
          }`}
          title={isAllSelected ? "Deselect All" : "Select All"}
        >
          <svg
            className="w-4 h-4"
            fill={isAllSelected ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isAllSelected ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            ) : (
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
                ry="2"
                strokeWidth={2}
              />
            )}
          </svg>
        </button>

        {/* Selection Counter with Text */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-opacity bg-blue-50 text-blue-700 opacity-100">
            Selected ({selectedCount})
          </div>
        )}

        {/* Custom Actions (for flagged posts specific actions) */}
        {customActions}

        {/* Delete Selected Icon Button */}
        {onBulkDelete && (
          <button
            onClick={onBulkDelete}
            disabled={isBulkDeleting || selectedCount === 0}
            className={`p-1.5 rounded transition-all ${
              selectedCount > 0
                ? isBulkDeleting
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-red-600 hover:bg-red-50"
                : "text-gray-400 cursor-not-allowed"
            }`}
            title="Delete Selected"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}

        {/* Revert Selected Icon Button */}
        {onBulkRevert && viewType === "completed" && (
          <button
            onClick={onBulkRevert}
            disabled={isBulkReverting || selectedCount === 0}
            className={`p-1.5 rounded transition-all ${
              selectedCount > 0
                ? isBulkReverting
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-orange-600 hover:bg-orange-50"
                : "text-gray-400 cursor-not-allowed"
            }`}
            title="Revert Selected Posts"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </button>
        )}
        {onBulkRestore && viewType === "deleted" && (
          <button
            onClick={onBulkRestore}
            disabled={isBulkRestoring || selectedCount === 0}
            className={`p-1.5 rounded transition-all ${
              selectedCount > 0
                ? isBulkRestoring
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-green-600 hover:bg-green-50"
                : "text-gray-400 cursor-not-allowed"
            }`}
            title="Restore Selected Posts"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        )}
        <button
          onClick={onClearSelection}
          disabled={selectedCount === 0}
          className={`p-1.5 rounded transition-all ${
            selectedCount > 0
              ? "text-gray-600 hover:bg-gray-50"
              : "text-gray-400 cursor-not-allowed"
          }`}
          title="Clear Selection"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
