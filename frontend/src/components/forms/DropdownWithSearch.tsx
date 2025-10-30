import { useState, useRef, useEffect } from "react";
import { FiChevronDown, FiChevronUp, FiX } from "react-icons/fi";

type DropdownProps = {
  label?: string;
  data: string[];
  selected: string | null;
  setSelected: (value: string | null) => void;
  placeholder?: string;
  error?: boolean;
};

const DropdownWithSearch = ({
  label,
  data,
  selected,
  setSelected,
  placeholder = "Select here",
  error = false,
}: DropdownProps) => {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredData = data.filter((item) =>
    item.toLowerCase().includes(search.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setExpanded(false);
        setSearch("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {label && <label className="block text-[14px] mb-3">{label}</label>}

      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex justify-between items-center bg-grayg border rounded text-left focus:outline-none focus-within:ring-2 focus-within:ring-blue-500 ${
          error ? "border-2 border-red-500" : "border border-gray-500"
        } px-2 py-2`}
      >
        <span
          className={`block truncate text-sm ${
            selected
              ? "text-gray-700"
              : "text-gray-500 bg-gray-100 px-2 py-1 rounded"
          }`}
        >
          {selected || placeholder}
        </span>

        <div className="flex items-center gap-2">
          {selected && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setSelected(null);
              }}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <FiX size={16} />
            </span>
          )}
          {expanded ? (
            <FiChevronUp size={20} className="text-gray-400" />
          ) : (
            <FiChevronDown size={20} className="text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60">
          {/* Search Input */}
          <div className="border-b border-gray-200 px-3 py-2">
            <input
              type="text"
              placeholder="Search locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-sm text-gray-700 border-none outline-none placeholder-gray-500"
              autoFocus
            />
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredData.length > 0 ? (
              filteredData.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setSelected(item);
                    setExpanded(false);
                    setSearch("");
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                >
                  {item}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No results found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DropdownWithSearch;
