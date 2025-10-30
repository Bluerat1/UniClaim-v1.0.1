import { useToast } from "@/context/ToastContext";

interface ToastFormParams {
  hasReportTypeError: boolean;
  hasTitleError: boolean;
  hasCategoryError: boolean;
  hasDescriptionError: boolean;
  hasDateTimeError: boolean;
  hasImageError: boolean;
  hasLocationError: boolean;
  hasCoordinatesError: boolean;
}

const useToastFormHelper = () => {
  const { showToast } = useToast();

  const validateFormErrors = (params: ToastFormParams): boolean => {
    const {
      hasReportTypeError,
      hasTitleError,
      hasCategoryError,
      hasDescriptionError,
      hasDateTimeError,
      hasImageError,
      hasLocationError,
      hasCoordinatesError,
    } = params;

    const fieldErrors = [
      hasReportTypeError,
      hasTitleError,
      hasCategoryError,
      hasDescriptionError,
      hasDateTimeError,
      hasImageError,
      hasLocationError,
      hasCoordinatesError,
    ];

    // ✅ Check if ANY required field is missing
    const hasAnyError = fieldErrors.some(Boolean);
    
    if (hasAnyError) {
      // Show individual toasts for missing fields

      // Show individual toasts for missing fields
      if (hasReportTypeError) {
        showToast(
          "error",
          "Report Type Missing",
          "Please select whether the item is lost or found.",
          5000
        );
      }

      if (hasTitleError) {
        showToast(
          "error",
          "Title Required",
          "Please enter the title of your post.",
          5000
        );
      }

      if (hasCategoryError) {
        showToast(
          "error",
          "Item Category Missing",
          "Choose the category of the item.",
          5000
        );
      }

      if (hasDescriptionError) {
        showToast(
          "error",
          "Description Required",
          "Please enter a description for the item.",
          5000
        );
      }

      if (hasDateTimeError) {
        showToast(
          "error",
          "Date & Time Required",
          "Please select when the item was lost or found.",
          5000
        );
      }

      if (hasImageError) {
        showToast(
          "error",
          "Photos Required",
          "At least one photo is required for your report. Please select an image to continue.",
          5000
        );
      }

      if (hasLocationError) {
        showToast(
          "error",
          "Last Location Missing",
          "Select the last seen location of the item.",
          5000
        );
      }

      if (hasCoordinatesError) {
        showToast(
          "error",
          "Location Pin Required",
          "Please pin a location on the map.",
          5000
        );
      }

      return true; // Return true to indicate validation failed
    }

    // If no errors, return false to allow submission
    return false;
  };

  return { validateFormErrors };
};

export default useToastFormHelper;
