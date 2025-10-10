import React from "react";
import CategoryButton from "../components/ItemCategory";
import { FiChevronDown } from "react-icons/fi";
import { USTP_LOCATIONS, CATEGORIES_WITH_COLORS } from "@/constants";

interface FiltersProps {
  description: string;
  setDescription: (val: string) => void;
  location: string;
  setLocation: (val: string) => void;
  onSearchSubmit: () => void;
  // ✅ New props for instant category filtering
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (val: string) => void;
}

const Filters: React.FC<FiltersProps> = ({
  description,
  setDescription,
  location,
  setLocation,
  onSearchSubmit,
  // ✅ New props for instant category filtering
  selectedCategoryFilter,
  setSelectedCategoryFilter,
}) => {
  // ✅ Handler for instant category filtering
  const handleCategoryClick = (categoryLabel: string) => {
    // Update instant filter only
    setSelectedCategoryFilter(categoryLabel);
  };

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSearchSubmit();
        }}
      >
        <div className="flex w-full flex-col items-center gap-6 mt-5 lg:flex-row lg:items-start">
          {/* Category buttons */}
          <div className="w-full lg:max-w-[18rem] space-y-3">
            <h1 className="text-sm">Item Category</h1>
            <div className="flex flex-wrap w-full gap-3 lg:flex-wrap">
              {CATEGORIES_WITH_COLORS.map((category) => (
                <CategoryButton
                  key={category.label}
                  label={category.label}
                  color={category.color}
                  active={selectedCategoryFilter === category.label}
                  onClick={() => handleCategoryClick(category.label)}
                  onClear={() => {
                    setSelectedCategoryFilter("All");
                  }}
                />
              ))}
            </div>
          </div>

          {/* Location dropdown */}
          <div className="w-full space-y-3 lg:max-w-md">
            <h1 className="text-sm">Last seen location</h1>
            <div className="relative">
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="border appearance-none px-3 py-2 w-full rounded-md text-sm"
              >
                <option value="">All locations</option>
                {USTP_LOCATIONS.map((loc: string) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-black pointer-events-none" />
            </div>
          </div>

          {/* Description input */}
          <div className="w-full space-y-3 lg:max-w-md">
            <h1 className="text-sm">Match with item description</h1>
            <input
              type="text"
              placeholder="Description keywords..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border px-3 py-2 w-full rounded-md placeholder:text-sm"
            />
          </div>
        </div>

        {/* Separator line */}
        <div className="w-full flex justify-center my-8">
          <div className="h-[1px] bg-gray-300 w-full max-w-7xl" />
        </div>
      </form>
    </>
  );
};

export default Filters;
