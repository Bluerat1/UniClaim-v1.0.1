// src/pages/ReportPage.tsx
import { useEffect, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import MobileNavText from "@/components/NavHeadComp";
import { useToast } from "@/context/ToastContext";
import { useAuth } from "@/context/AuthContext";
import ItemInfoForm from "@/components/ItemInfoForm";
import FoundActionModal from "@/components/FoundActionModal";
import SuccessPic from "@/assets/success.png";
// import { useNavigate } from "react-router-dom";
import type { Post } from "@/types/Post";

// screens
import LocationForm from "@/routes/user-routes/LocationReport";
import ContactDetails from "@/routes/user-routes/ContactDetails";
import useToastFormHelper from "@/components/ToastFormHelper";
import { ITEM_CATEGORIES } from "@/constants";

export default function ReportPage() {
  const { userData, loading } = useAuth();
  const [selectedReport, setSelectedReport] = useState<"lost" | "found" | null>(
    null
  );

  // Add near the other useState hooks:
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const [selectedDateTime, setSelectedDateTime] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [wasSubmitted, setWasSubmitted] = useState(false);
  const { validateFormErrors } = useToastFormHelper();
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const { showToast } = useToast();
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<string>("");
  const [uploadProgress, setUploadProgress] = useState<any[]>([]);

  // New state for found action modal
  const [showFoundActionModal, setShowFoundActionModal] = useState(false);
  const [selectedFoundAction, setSelectedFoundAction] = useState<
    "keep" | "turnover to OSA" | "turnover to Campus Security" | null
  >(null);

  useEffect(() => {
    if (showSuccessModal) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
  }, [showSuccessModal]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const totalFiles = selectedFiles.length + files.length;

    if (totalFiles > 3) {
      showToast(
        "error",
        "Upload limit reached",
        "You can only upload up to 3 images only.",
        8000
      );
      return;
    }

    const newValidFiles: File[] = [];
    files.forEach((file) => {
      // Check if file is a GIF
      if (file.type === 'image/gif') {
        showToast(
          "error",
          "Unsupported Format",
          `GIF files are not supported. Please upload JPG or PNG images instead.`,
          8000
        );
        return;
      }

      // Check if file is an image (JPG, PNG, etc.)
      if (!file.type.startsWith('image/')) {
        showToast(
          "error",
          "Invalid File Type",
          `"${file.name}" is not a valid image file. Please upload JPG or PNG images only.`,
          8000
        );
        return;
      }

      const isDuplicate = selectedFiles.some(
        (f) => f.name === file.name && f.size === file.size
      );
      if (isDuplicate) {
        showToast(
          "error",
          "Duplicate Image",
          `The image "${file.name}" has already been uploaded.`
        );
      } else {
        newValidFiles.push(file);
      }
    });

    const updatedFiles = [...selectedFiles, ...newValidFiles].slice(0, 3);
    setSelectedFiles(updatedFiles);
    e.target.value = "";
  };

  const removeFile = (name: string) => {
    setSelectedFiles((prev) => prev.filter((file) => file.name !== name));
  };

  const handleFoundActionSelect = (
    action: "keep" | "turnover to OSA" | "turnover to Campus Security"
  ) => {
    setSelectedFoundAction(action);
    setShowFoundActionModal(false);
  };

  const handleReportClick = (type: "lost" | "found") => {
    if (selectedReport === type) {
      setSelectedReport(null); // 👈 deselect if same type is clicked again
      if (type === "found") {
        setSelectedFoundAction(null); // Clear found action when deselecting
      }
    } else {
      setSelectedReport(type);
      if (type === "found") {
        setShowFoundActionModal(true); // Show modal for found items
      }
    }
    setWasSubmitted(false);
  };

  // Reset red borders when user types in title or description
  useEffect(() => {
    if (title || description) setWasSubmitted(false);
  }, [title, description]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Prevent duplicate submissions
    if (isSubmitting) {
      console.log(
        "Form submission already in progress, ignoring duplicate submit"
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitProgress("Validating form...");
    setWasSubmitted(true);

    const errors = {
      hasReportTypeError: !selectedReport,
      hasTitleError: !title.trim(),
      hasCategoryError: !activeCategory,
      hasDescriptionError: !description.trim(),
      hasDateTimeError: !selectedDateTime.trim(),
      hasImageError: selectedFiles.length === 0,
      hasLocationError: !selectedLocation,
      hasCoordinatesError: !coordinates,
    };

    const hasError = validateFormErrors(errors);
    if (hasError) {
      setIsSubmitting(false); // Reset submitting state if validation fails
      setSubmitProgress("");
      return;
    }

    // ✅ Type narrowing to satisfy Post.type
    if (selectedReport !== "lost" && selectedReport !== "found") {
      // This should never happen since validateFormErrors already checked this
      console.error(
        "Unexpected: selectedReport validation failed after validateFormErrors passed"
      );
      setIsSubmitting(false);
      setSubmitProgress("");
      return;
    }

    // if (!userInfo) {
    //   showToast("error", "User missing", "User information is not loaded yet.");
    //   return;
    // }

    try {
      // Ensure userData is available
      if (!userData) {
        throw new Error("User data not available");
      }

      setSubmitProgress("Preparing your report...");

      // Check if this should be transferred to Campus Security
      const shouldTransferToCampusSecurity =
        selectedReport === "found" &&
        selectedFoundAction === "turnover to Campus Security";

      // Get real Campus Security user data
      let campusSecurityData = null;
      let campusSecurityUserId = null;

      if (shouldTransferToCampusSecurity) {
        const { authService } = await import("../../services/firebase/auth");
        const campusSecurityUser = await authService.getCampusSecurityUser();

        if (campusSecurityUser) {
          campusSecurityData = {
            firstName: campusSecurityUser.firstName,
            lastName: campusSecurityUser.lastName,
            email: campusSecurityUser.email,
            contactNum: campusSecurityUser.contactNum,
            studentId: campusSecurityUser.studentId,
            profilePicture: campusSecurityUser.profilePicture || null,
          };
          campusSecurityUserId = campusSecurityUser.uid;
        } else {
          // Fallback to hardcoded data if no Campus Security user found
          campusSecurityData = {
            firstName: "Campus",
            lastName: "Security",
            email: "cs@uniclaim.com",
            contactNum: "",
            studentId: "",
            profilePicture: null,
          };
          campusSecurityUserId = "hedUWuv96VWQek5OucPzXTCkpQU2";
        }
      }

      // Build post data conditionally to avoid undefined values in Firebase
      const createdPost: Omit<Post, "id" | "createdAt"> = {
        title: title.trim(),
        description: description.trim(),
        category: activeCategory,
        location: selectedLocation || "",
        type: selectedReport,
        images: selectedFiles,
        dateTime: selectedDateTime,
        creatorId: shouldTransferToCampusSecurity
          ? campusSecurityUserId!
          : userData.uid, // Transfer ownership if needed
        user: shouldTransferToCampusSecurity
          ? campusSecurityData!
          : {
              firstName: userData?.firstName || "",
              lastName: userData?.lastName || "",
              email: userData?.email || "",
              contactNum: userData?.contactNum || "",
              studentId: userData?.studentId || "",
              profilePicture: userData?.profilePicture || null, // Ensure it's never undefined
              role: userData?.role || "user", // Include user role
            },
        status: "pending",
      };

      // Add found action if this is a found item
      if (selectedReport === "found" && selectedFoundAction) {
        createdPost.foundAction = selectedFoundAction;
      }

      // Add turnover details for both OSA and Campus Security turnover
      if (
        selectedReport === "found" &&
        selectedFoundAction &&
        (selectedFoundAction === "turnover to OSA" ||
          selectedFoundAction === "turnover to Campus Security")
      ) {
        createdPost.turnoverDetails = {
          originalFinder: {
            uid: userData.uid,
            firstName: userData?.firstName || "",
            lastName: userData?.lastName || "",
            email: userData?.email || "",
            contactNum: userData?.contactNum || "",
            studentId: userData?.studentId || "",
            profilePicture: userData?.profilePicture || null,
          },
          turnoverAction: selectedFoundAction,
          turnoverDecisionAt: new Date(), // Will be converted to Firebase timestamp
          turnoverStatus:
            selectedFoundAction === "turnover to OSA"
              ? "declared"
              : "transferred", // Different statuses for different workflows
          // Note: turnoverReason is optional and not included if undefined
        };
      }

      // Only add optional fields if they have valid values
      if (coordinates) {
        createdPost.coordinates = coordinates;
      }

      setSubmitProgress("Uploading images...");

      // Use Firebase service to create post (with admin notifications)
      const { postService } = await import("../../services/firebase/posts");

      // Prepare post data with images for upload
      const postDataWithImages = {
        ...createdPost,
        images: selectedFiles // Pass files directly for concurrent upload
      };

      // Create post with concurrent image upload
      const postId = await postService.createPostWithConcurrentUpload(
        postDataWithImages,
        shouldTransferToCampusSecurity ? campusSecurityUserId! : userData.uid,
        {
          onProgress: (progress: any[]) => {
            setUploadProgress(progress);
            const completed = progress.filter(p => p.status === 'completed').length;
            const total = progress.length;
            const avgProgress = progress.reduce((sum: number, p: any) => sum + p.percentage, 0) / total;

            setSubmitProgress(`Uploading images... (${completed}/${total} completed, ${avgProgress.toFixed(0)}% avg)`);
          }
        }
      );

      setSubmitProgress("Sending notifications...");

      console.log("Post created successfully with ID:", postId);

      // Clear form
      setTitle("");
      setDescription("");
      setSelectedReport(null);
      setSelectedLocation(null);
      setCoordinates(null);
      setActiveCategory("");
      setSelectedDateTime("");
      setSelectedFiles([]);
      setSelectedFoundAction(null);
      setWasSubmitted(false);
      setSubmitProgress("");
      setUploadProgress([]);
      setShowSuccessModal(true);

      showToast(
        "success",
        "Post Created",
        "Your report has been submitted successfully!"
      );
    } catch (error: any) {
      console.error("Error creating post:", error);
      setSubmitProgress("");
      setUploadProgress([]);
      showToast(
        "error",
        "Submission Failed",
        error.message || "Failed to submit report. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // compute errors during render
  const showReportTypeError = wasSubmitted && !selectedReport;
  const showTitleError = wasSubmitted && !title.trim();
  const showDescriptionError = wasSubmitted && !description.trim();
  const showDateTimeError = wasSubmitted && !selectedDateTime.trim();
  const showImageError = wasSubmitted && selectedFiles.length === 0;
  const showLocationError = wasSubmitted && !selectedLocation;

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Show error if no user data
  if (!userData) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-red-500">Please log in to report an item</p>
      </div>
    );
  }

  return (
    <section className="mb-12">
      <MobileNavText
        title="Report an item"
        description="Report a lost or found item"
      />

      <div className="hidden lg:flex lg:items-center lg:justify-between lg:mx-6 lg:pt-4">
        <h1 className="font-medium">Report an item</h1>
        <p className="text-sm text-gray-500">
          Report a lost or found item here.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div>
          <h1 className="mx-4 pt-4 font-medium lg:mx-6">
            Status of the item
            <span className="text-red-500 ml-1">*</span>
          </h1>
          <div
            className={`flex gap-3 mt-4 mx-4 lg:mx-6 ${
              showReportTypeError ? "border-2 border-red-500 rounded p-2" : ""
            }`}
          >
            <button
              type="button"
              className={`p-2 w-full lg:max-w-[12rem] rounded text-md font-medium transition-colors duration-200 ${
                selectedReport === "lost"
                  ? "bg-navyblue text-white"
                  : "bg-gray-200 text-black hover:bg-blue-300 hover:text-black"
              }`}
              onClick={() => handleReportClick("lost")}
            >
              <span className="flex items-center justify-center gap-1">
                Lost Item
                {selectedReport === "lost" && (
                  <FiX className="w-4 h-4 text-white" />
                )}
              </span>
            </button>

            <button
              type="button"
              className={`p-2 w-full lg:max-w-[12rem] rounded text-md font-medium transition-colors duration-200 ${
                selectedReport === "found"
                  ? "bg-navyblue text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-300 hover:text-black"
              }`}
              onClick={() => handleReportClick("found")}
            >
              <span className="flex items-center justify-center gap-1">
                {selectedReport === "found" && selectedFoundAction
                  ? `Found (${
                      selectedFoundAction === "keep"
                        ? "Keep"
                        : selectedFoundAction === "turnover to OSA"
                        ? "OSA"
                        : "Campus Security"
                    })`
                  : "Found Item"}
                {selectedReport === "found" && (
                  <FiX className="w-4 h-4 text-white" />
                )}
              </span>
            </button>
          </div>
          {showReportTypeError && (
            <p className="text-red-500 text-sm mx-4 mt-2 lg:mx-6">
              Please select whether the item is lost or found
            </p>
          )}
        </div>

        <div className="bg-gray-300 h-[1px] mx-4 mt-5 lg:mx-6" />

        <h1 className="mx-4 mt-4 font-medium lg:mx-6">
          Information of the item
          <span className="text-red-500 ml-1">*</span>
        </h1>

        <div className="mx-4 mt-4 lg:mx-6">
          <ItemInfoForm
            titleError={showTitleError}
            descriptionError={showDescriptionError}
            dateTimeError={showDateTimeError}
            imageError={showImageError}
            categories={ITEM_CATEGORIES}
            activeCategory={activeCategory}
            setActiveCategory={(category) => {
              setActiveCategory(category);
              setWasSubmitted(false);
            }}
            selectedDateTime={selectedDateTime}
            setSelectedDateTime={setSelectedDateTime}
            selectedFiles={selectedFiles}
            setSelectedFiles={setSelectedFiles}
            showModal={showModal}
            setShowModal={setShowModal}
            fileInputRef={fileInputRef}
            modalInputRef={modalInputRef}
            handleFileChange={handleFileChange}
            removeFile={removeFile}
            title={title}
            setTitle={(val) => {
              setTitle(val);
              setWasSubmitted(false);
            }}
            description={description}
            setDescription={(val) => {
              setDescription(val);
              setWasSubmitted(false);
            }}
          />
        </div>

        <div className="bg-gray-300 h-[1px] mx-4 mt-5 lg:mx-6" />

        <div className="grid mx-4 mt-4 grid-cols-1 gap-3 lg:mx-6 lg:grid-cols-2 lg:gap-8">
          <LocationForm
            selectedLocation={selectedLocation}
            setSelectedLocation={(val) => {
              setSelectedLocation(val);
              setWasSubmitted(false); // ✅ clear error feedback after location change
            }}
            locationError={showLocationError}
            coordinates={coordinates}
            setCoordinates={(val) => {
              setCoordinates(val);
              setWasSubmitted(false); // ✅ clear error feedback after map pin drop
            }}
          />

          <ContactDetails />
        </div>

        <div className="mx-4 mt-5">
          <div className="text-center mt-5 mb-3">
            <h2 className="text-blue-500 text-[13px]">
              <strong>Note:</strong> Ticket will expire within 30 days if not
              found.
            </h2>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full text-white rounded p-3 block cursor-pointer transition-colors ${
              isSubmitting
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-brand hover:bg-yellow-600"
            }`}
          >
            {isSubmitting ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{submitProgress || "Submitting..."}</span>
                </div>
                {uploadProgress.length > 0 && (
                  <div className="text-xs mt-1 text-gray-200">
                    {uploadProgress.filter(p => p.status === 'completed').length}/{uploadProgress.length} images uploaded
                  </div>
                )}
              </div>
            ) : (
              "Submit report"
            )}
          </button>
        </div>
      </form>
      {/* Found Action Modal */}
      <FoundActionModal
        isOpen={showFoundActionModal}
        onClose={() => setShowFoundActionModal(false)}
        onCancel={() => {
          setShowFoundActionModal(false);
          setSelectedReport(null); // Reset found item selection
          setSelectedFoundAction(null); // Reset selected action
        }}
        onActionSelect={handleFoundActionSelect}
        // selectedAction={selectedFoundAction}
      />

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 bg-opacity-40">
          <div className="flex flex-col items-center justify-center text-center bg-white rounded p-5 w-90 max-w-lg">
            <img src={SuccessPic} alt="success_img" className="size-40" />
            <h1 className="text-medium text-xl text-[#39B54A] mb-5">
              Successfully added report!
            </h1>
            <p className="text-[12px] mb-5">
              Your report has been added successfully. You can manage your post
              in the my tickets dashboard
            </p>
            <div className="h-1 my-5 rounded w-60 bg-[#39B54A]"></div>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="mt-4 text-sm w-full bg-[#39B54A] hover:bg-green-700 text-white p-2 rounded transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
