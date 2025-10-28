import { useState } from "react";
import { IoChevronDown, IoChevronUp } from "react-icons/io5";

type ViewType = "all" | "lost" | "found" | "completed";

interface MobileFilterProps {
  viewType: ViewType;
  onViewTypeChange: (type: ViewType) => void;
  className?: string;
}

export default function MobileFilter({
  viewType,
  onViewTypeChange,
  className = "",
}: MobileFilterProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const handleFilterClick = (type: ViewType) => {
    onViewTypeChange(type);
    // Auto-collapse after selection on mobile
    if (window.innerWidth < 768) {
      setIsExpanded(false);
    }
  };

  return (
    <div className={`relative z-50 ${className}`}>
      {/* Main Filter Button - Always Visible */}
      <button
        onClick={toggleExpand}
        className="flex items-center justify-between w-full px-4 py-3 bg-white border border-gray-300 rounded-md"
      >
        <span className="font-medium-manrope  text-sm text-navyblue">
          {viewType === "all"
            ? "All Item Reports"
            : viewType === "lost"
            ? "Lost Items"
            : viewType === "found"
            ? "Found Items"
            : "Completed Items"}
        </span>
        {isExpanded ? (
          <IoChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <IoChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {/* Dropdown Menu */}
      <div
        className={`${
          isExpanded ? "block" : "hidden"
        } absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg`}
      >
        <div className="p-2 space-y-1 text-sm">
          <button
            className={`w-full text-left px-4 py-2 rounded-md ${
              viewType === "all"
                ? "bg-navyblue/10 text-navyblue font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => handleFilterClick("all")}
          >
            All Item Reports
          </button>
          <button
            className={`w-full text-left px-4 py-2 rounded-md ${
              viewType === "lost"
                ? "bg-navyblue/10 text-navyblue font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => handleFilterClick("lost")}
          >
            Lost Items
          </button>
          <button
            className={`w-full text-left px-4 py-2 rounded-md ${
              viewType === "found"
                ? "bg-navyblue/10 text-navyblue font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => handleFilterClick("found")}
          >
            Found Items
          </button>
          <button
            className={`w-full text-left px-4 py-2 rounded-md flex items-center justify-between ${
              viewType === "completed"
                ? "bg-navyblue/10 text-navyblue font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => handleFilterClick("completed")}
          >
            <span>Completed Items</span>
            <span className="text-xs text-blue-500 ml-2">30 days</span>
          </button>
        </div>
      </div>
    </div>
  );
}
