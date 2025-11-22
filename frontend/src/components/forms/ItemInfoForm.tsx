// src/components/ItemInfoForm.tsx
import { FiX, FiUpload, FiEye } from "react-icons/fi";
import { useState, useRef, useEffect } from "react";
import { useToast } from "@/context/ToastContext";

interface Props {
  titleError: boolean;
  descriptionError: boolean;
  dateTimeError: boolean;
  imageError: boolean;
  categories: string[];
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  selectedDateTime: string;
  setSelectedDateTime: (val: string) => void;
  selectedFiles: File[];
  setSelectedFiles: (files: File[]) => void;
  showModal: boolean;
  setShowModal: (val: boolean) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  modalInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (name: string) => void;
  title: string;
  setTitle: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
}

export default function ItemInfoForm({
  titleError,
  descriptionError,
  dateTimeError,
  imageError,
  categories,
  activeCategory,
  setActiveCategory,
  selectedDateTime,
  setSelectedDateTime,
  selectedFiles,
  showModal,
  setShowModal,
  fileInputRef,
  modalInputRef,
  handleFileChange,
  removeFile,
  title,
  setTitle,
  description,
  setDescription,
}: Props) {
  const dateTimeInputRef = useRef<HTMLInputElement>(null);
  const [isDateTimeFocused, setIsDateTimeFocused] = useState(false);
  const { showToast } = useToast();

  // Handle date/time change with validation
  const handleDateTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = new Date(e.target.value);
    const currentDate = new Date();

    // Check if selected date is in the future
    if (selectedDate > currentDate) {
      showToast(
        "error",
        "Invalid Date",
        "You cannot set a future date. Please select a date and time in the past or present.",
        6000
      );
      setSelectedDateTime("");
      return;
    }

    setSelectedDateTime(e.target.value);
  };

  // Handle clicking outside to close the date/time picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dateTimeInputRef.current &&
        !dateTimeInputRef.current.contains(event.target as Node)
      ) {
        setIsDateTimeFocused(false);
      }
    };

    if (isDateTimeFocused) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isDateTimeFocused]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
      {/* Left column */}
      <div className="flex flex-col">
        <label className="block text-[14px] mb-3">
          Title
          <span className="text-red-500 ml-1">*</span>
        </label>
        <input
          type="text"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter the item title"
          className={`w-full p-2 border rounded ${
            titleError ? "border-2 border-red-500" : "border-gray-500"
          } focus:outline-none focus:ring-1 focus:ring-black`}
        />

        <label className="block mb-4 mt-4 text-[14px]">
          Item Category
          <span className="text-red-500 ml-1">*</span>
        </label>
        <div className="w-full flex flex-row gap-3 mb-4">
          {categories.map((category) => (
            <button
              type="button" // Prevent form submit
              key={category}
              onClick={() =>
                activeCategory === category
                  ? setActiveCategory("")
                  : setActiveCategory(category)
              }
              className={`w-full p-2 rounded font-medium transition-all duration-300 ${
                activeCategory === category
                  ? "bg-navyblue text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-dark-navyblue/15"
              }`}
            >
              <span className="flex items-center justify-center gap-1">
                {category}
                {activeCategory === category && (
                  <FiX className="w-4 h-4 text-white" />
                )}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-4 lg:flex lg:flex-row lg:gap-4">
          <div className="w-full">
            <label className="block font-medium text-[14px] text-gray-700 mb-3">
              Date and Time Found
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div
              className={`w-full flex items-center rounded px-4 py-3 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 ${
                dateTimeError
                  ? "border-2 border-red-500"
                  : "border border-gray-500"
              }`}
              onClick={() => {
                if (!isDateTimeFocused) {
                  // Open the picker if not already focused
                  if (dateTimeInputRef.current) {
                    if (dateTimeInputRef.current.showPicker) {
                      dateTimeInputRef.current.showPicker();
                    } else {
                      dateTimeInputRef.current.click();
                    }
                  }
                }
                setIsDateTimeFocused(!isDateTimeFocused);
              }}
            >
              <input
                ref={dateTimeInputRef}
                type="datetime-local"
                value={selectedDateTime}
                onChange={handleDateTimeChange}
                onFocus={() => setIsDateTimeFocused(true)}
                onBlur={() => setIsDateTimeFocused(false)}
                className="w-full outline-none bg-transparent text-sm text-gray-700"
              />
            </div>
          </div>

          <div className="w-full relative">
            <label className="block font-medium text-[14px] text-gray-700 mb-3">
              Upload up to 3 Images
              <span className="text-red-500 ml-1">*</span>
            </label>
            <div
              onClick={() => {
                if (selectedFiles.length < 3 && fileInputRef?.current) {
                  fileInputRef.current.click();
                }
              }}
              className={`flex items-center justify-between px-4 py-3 rounded cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 ${
                imageError
                  ? "border-2 border-red-500"
                  : "border border-gray-500"
              }`}
            >
              <span className="text-sm text-gray-700 truncate">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} file${
                      selectedFiles.length > 1 ? "s" : ""
                    } selected`
                  : "No file chosen"}
              </span>
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                multiple
              />
              {selectedFiles.length > 0 ? (
                <FiEye
                  className="w-5 h-5 text-black stroke-[1.5px] cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent triggering upload
                    setShowModal(true);
                  }}
                />
              ) : (
                <FiUpload className="w-5 h-5 text-black stroke-[2px]" />
              )}
            </div>

            {showModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45">
                <div className="bg-white rounded mx-5 w-full max-w-3xl max-h-[90vh] overflow-y-auto p-5 relative">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-md font-medium">
                      Your uploaded images
                    </h2>
                    <button
                      onClick={() => setShowModal(false)}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <FiX className="size-6 stroke-[1.5px]" />
                    </button>
                  </div>

                  {selectedFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-80 text-gray-500 text-sm">
                      <p>No images uploaded yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                      {selectedFiles.map((file) => {
                        const imageURL = URL.createObjectURL(file);
                        return (
                          <div key={file.name} className="relative group">
                            <img
                              src={imageURL}
                              alt={file.name}
                              className="w-full h-auto object-cover rounded"
                            />
                            <button
                              onClick={() => removeFile(file.name)}
                              className="absolute top-3 right-3 bg-white text-red-500 hover:text-red-700 rounded p-1"
                            >
                              <FiX className="size-5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedFiles.length < 3 && (
                    <>
                      <input
                        type="file"
                        accept="image/*"
                        ref={modalInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        multiple
                      />
                      <button
                        type="button"
                        onClick={() => modalInputRef?.current?.click()}
                        className="flex items-center w-full justify-center gap-2 bg-brand text-white px-4 py-2 rounded hover:bg-yellow-600 transition"
                      >
                        <FiUpload className="size-4" />
                        Upload More
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="mt-6 lg:mt-0">
        <label className="mb-3 block text-[14px]">
          Description of the item
          <span className="text-red-500 ml-1">*</span>
        </label>
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the item here..."
          className={`w-full p-2 border rounded resize-none
            ${descriptionError ? "border-2 border-red-500" : "border-gray-500"}
            focus:outline-none focus:ring-1 focus:ring-black
            h-32 sm:h-36 md:h-38 lg:h-58
          `}
        />
      </div>
    </div>
  );
}
