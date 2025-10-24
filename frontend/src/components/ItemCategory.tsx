import React from "react";
import clsx from "clsx";

interface CategoryProps {
  label: string;
  active: boolean;
  onClick: () => void;
  onClear: () => void;
  color: string;
}

const ItemCategory: React.FC<CategoryProps> = ({
  label,
  active,
  onClick,
  onClear,
  color,
}) => {
  const hoverColors = {
    brand: "hover:bg-navyblue hover:text-white",
    yellow: "hover:bg-yellow-300",
    blue: "hover:bg-blue-400",
    green: "hover:bg-purple-400",
  };

  const activeColors = {
    brand: "bg-navyblue text-white",
    yellow: "bg-yellow-300",
    blue: "bg-blue-400",
    green: "bg-purple-400",
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button" // ✅ Prevents it from acting as a form submitter
        onClick={onClick}
        className={clsx(
          "px-4 py-2 pr-7 rounded-md text-black text-sm transition-colors duration-300",
          hoverColors[color as keyof typeof hoverColors],
          active
            ? activeColors[color as keyof typeof activeColors]
            : "bg-gray-200"
        )}
      >
        {label}
      </button>

      {active && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="absolute right-1 top-1/2 -translate-y-1/2 text-black rounded-full p-1"
        ></button>
      )}
    </div>
  );
};

export default ItemCategory;
