import { FiX } from "react-icons/fi";
import { useState, useEffect, useRef } from "react";
import type { Post } from "@/types/Post";
import DropdownWithSearch from "./DropdownWithSearch";
import LocationMap from "./LocationMap";

// Helper function to get status color and text
const getStatusStyles = (status: string | undefined) => {
  switch (status?.toLowerCase()) {
    case "resolved":
      return {
        bgColor: "bg-green-100",
        textColor: "text-green-800",
        borderColor: "border-green-200",
        displayText: "Resolved",
      };
    case "completed":
      return {
        bgColor: "bg-green-100",
        textColor: "text-green-800",
        borderColor: "border-green-200",
        displayText: "Completed",
      };
    case "pending":
      return {
        bgColor: "bg-yellow-100",
        textColor: "text-yellow-800",
        borderColor: "border-yellow-200",
        displayText: "Pending",
      };
    case "unclaimed":
      return {
        bgColor: "bg-blue-100",
        textColor: "text-blue-800",
        borderColor: "border-blue-200",
        displayText: "Unclaimed",
      };
    default:
      return {
        bgColor: "bg-gray-100",
        textColor: "text-gray-800",
        borderColor: "border-gray-200",
        displayText: status || "Pending",
      };
  }
};

// Location options - same as used in mobile version
const locationOptions = [
  "Library",
  "Canteen",
  "Gymnasium",
  "Main Entrance",
  "Computer Laboratory",
  "Science Building",
  "Engineering Hall",
  "Student Lounge",
  "Registrar Office",
  "Clinic",
  "Parking Lot A",
  "Parking Lot B",
  "Auditorium",
  "Basketball Court",
  "Swimming Pool Area",
  "Admin Office",
  "Dormitory",
  "Innovation Hub",
  "Covered Court",
  "Security Office",
];

interface TicketModalProps {
  post: Post;
  onClose: () => void;
  onDelete: (id: string) => void;
  onUpdatePost: (updatedPost: Post) => void;
  isDeleting?: boolean;
  isAdmin?: boolean; // Allow admin to edit status, category, type
}

const TicketModal = ({
  post,
  onClose,
  onDelete,
  onUpdatePost,
  isDeleting,
  isAdmin = false,
}: TicketModalProps) => {
  // Category and Type styles to match PostModal
  const categoryStyles: Record<string, string> = {
    "Student Essentials": "bg-yellow-300 text-black",
    Gadgets: "bg-blue-400 text-black",
    "Personal Belongings": "bg-purple-300 text-black",
  };

  const typeStyles: Record<string, string> = {
    lost: "bg-red-100 text-red-700",
    found: "bg-green-100 text-green-700",
  };
  const [isEditing, setIsEditing] = useState(false);
  const [showImgModal, setShowImgModal] = useState(false);
  const [showImgOverlay, setShowImgOverlay] = useState(false);
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const inactivityIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastInteractionTimeRef = useRef<number>(Date.now());

  const [editedImages, setEditedImages] = useState<(string | File)[]>(
    post.images
  );
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);

  const [editedTitle, setEditedTitle] = useState(post.title);
  const [editedDescription, setEditedDescription] = useState(post.description);
  const [editedLocation, setEditedLocation] = useState<string | null>(
    locationOptions.includes(post.location) ? post.location : null
  );
  const [editedDateTime, setEditedDateTime] = useState(
    typeof post.createdAt === "string"
      ? post.createdAt.slice(0, 16)
      : new Date(post.createdAt || "").toISOString().slice(0, 16)
  );

  // Admin-editable fields
  const [editedStatus, setEditedStatus] = useState(post.status);
  const [editedCategory, setEditedCategory] = useState(post.category);
  const [editedType, setEditedType] = useState(post.type);

  // Prevent editing resolved or completed posts (unless admin)
  const handleEditClick = () => {
    if ((post.status === "resolved" || post.status === "completed") && !isAdmin) {
      return; // Do nothing for resolved or completed posts (unless admin)
    }
    setIsEditing(true);
  };

  // Reset form when post changes
  useEffect(() => {
    setEditedTitle(post.title);
    setEditedDescription(post.description);
    setEditedLocation(
      locationOptions.includes(post.location) ? post.location : null
    );
    setEditedImages(post.images);
    setNewImageFiles([]);

    // Reset admin fields
    setEditedStatus(post.status);
    setEditedCategory(post.category);
    setEditedType(post.type);

    // Prevent editing state for resolved or completed posts (unless admin)
    if ((post.status === "resolved" || post.status === "completed") && !isAdmin) {
      setIsEditing(false);
    }
  }, [post, isAdmin]);

  // Show the overlay after a couple of seconds if user doesn't click
  useEffect(() => {
    const checkInactivity = () => {
      const now = Date.now();
      const secondsSinceLastClick =
        (now - lastInteractionTimeRef.current) / 1000;

      if (secondsSinceLastClick >= 2) {
        setShowOverlay(true);
      }
    };

    inactivityIntervalRef.current = setInterval(checkInactivity, 1000);

    return () => {
      if (inactivityIntervalRef.current) {
        clearInterval(inactivityIntervalRef.current);
      }
    };
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (inactivityIntervalRef.current) {
        clearInterval(inactivityIntervalRef.current);
      }
    };
  }, []);

  const previewImages = editedImages.map((img) =>
    typeof img === "string" ? img : URL.createObjectURL(img)
  );

  const handleNextImage = () => {
    setCurrentImageIdx((prev) => (prev + 1) % previewImages.length);
  };

  const handleImageClick = () => {
    setShowOverlay(false);
    setHasUserInteracted(true);
    lastInteractionTimeRef.current = Date.now();
    setCurrentImageIdx((prev) => (prev + 1) % previewImages.length);
  };

  const handleDeleteImage = (index: number) => {
    // Prevent deletion if this is the last image
    if (editedImages.length <= 1) {
      return; // Don't allow deletion of the last image
    }

    const updated = [...editedImages];
    updated.splice(index, 1);
    setEditedImages(updated);
  };

  const handleUploadMore = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    if (editedImages.length + files.length > 3) {
      alert("You can only upload up to 3 images.");
      return;
    }
    setEditedImages([...editedImages, ...files]);
    setNewImageFiles([...newImageFiles, ...files]);
  };

  const handleSaveImages = () => {
    setShowImgModal(false);
  };

  const handleSaveEdits = () => {
    const updatedPost: Post = {
      ...post,
      title: editedTitle,
      description: editedDescription,
      location: editedLocation || "",
      status: isAdmin ? editedStatus : post.status, // Admin can change status, users cannot
      category: isAdmin ? editedCategory : post.category, // Admin can change category, users cannot
      type: isAdmin ? editedType : post.type, // Admin can change type, users cannot
      createdAt: editedDateTime,
      images: editedImages,
    };

    onUpdatePost(updatedPost);
    setIsEditing(false);
  };

  const inputFields = [
    {
      type: "text",
      value: editedTitle,
      placeholder: "Title",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setEditedTitle(e.target.value),
    },
    {
      type: "datetime-local",
      value: editedDateTime,
      placeholder: "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setEditedDateTime(e.target.value),
    },
  ];

  // Admin-only fields
  const adminFields = isAdmin
    ? [
        {
          type: "select",
          value: editedStatus,
          placeholder: "Status",
          options: [
            { value: "pending", label: "Pending" },
            { value: "resolved", label: "Resolved" },
            { value: "completed", label: "Completed" },
            { value: "unclaimed", label: "Unclaimed" },
          ],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            setEditedStatus(
              e.target.value as "pending" | "resolved" | "completed" | "unclaimed"
            ),
        },
        {
          type: "select",
          value: editedCategory,
          placeholder: "Category",
          options: [
            { value: "Student Essentials", label: "Student Essentials" },
            { value: "Gadgets", label: "Gadgets" },
            { value: "Personal Belongings", label: "Personal Belongings" },
          ],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            setEditedCategory(e.target.value),
        },
        {
          type: "select",
          value: editedType,
          placeholder: "Type",
          options: [
            { value: "lost", label: "Lost" },
            { value: "found", label: "Found" },
          ],
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
            setEditedType(e.target.value as "lost" | "found"),
        },
      ]
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-4 shadow-lg w-[25rem] sm:w-[26rem] md:w-[32rem] lg:w-[42rem] xl:w-[60rem] max-w-full max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{post.title}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-[3px] ${
                    typeStyles[post.type] || "bg-gray-100 text-gray-700"
                  }`}
                >
                  {post.type.charAt(0).toUpperCase() + post.type.slice(1)}
                </span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-[3px] ${
                    categoryStyles[post.category] || "bg-gray-100 text-gray-700"
                  }`}
                >
                  {post.category}
                </span>
                {post.status === "resolved" && post.claimDetails && (
                  <span className="px-2 py-1 text-xs font-medium rounded-[3px] bg-purple-100 text-purple-700">
                    Claimed
                  </span>
                )}
                {post.status === "resolved" && (
                  <span className="px-2 py-1 text-xs font-medium rounded-[3px] bg-green-100 text-green-700">
                    ✅ Resolved
                  </span>
                )}
                {post.status === "completed" && (
                  <span className="px-2 py-1 text-xs font-medium rounded-[3px] bg-green-100 text-green-700">
                    ✅ Completed
                  </span>
                )}
                {post.status === "unclaimed" && (
                  <span className="px-2 py-1 text-xs font-medium rounded-[3px] bg-orange-100 text-orange-700">
                    ⏰ Unclaimed
                  </span>
                )}
              </div>
            </div>
          </div>
          {isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(false)}
                className="bg-gray-500 text-white text-xs px-3 p-2 mr-2 rounded hover:bg-gray-600"
              >
                Cancel Edit
              </button>
              <button
                onClick={handleSaveEdits}
                className="bg-green-600 text-white text-xs px-3 p-2 mr-2 rounded hover:bg-green-500"
              >
                Save Changes
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEditClick}
                disabled={(post.status === "resolved" || post.status === "completed") && !isAdmin}
                className={`text-xs px-3 py-2 mr-2 rounded hover:bg-yellow-600 ${
                  (post.status === "resolved" || post.status === "completed") && !isAdmin
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-brand text-white hover:bg-yellow-600"
                }`}
                title={
                  (post.status === "resolved" || post.status === "completed") && !isAdmin
                    ? "Cannot edit resolved or completed tickets"
                    : "Edit ticket details"
                }
              >
                Edit Ticket
              </button>
              <button
                onClick={() => onDelete(post.id)}
                disabled={isDeleting || ((post.status === "resolved" || post.status === "completed") && !isAdmin)}
                className={`text-xs px-3 py-2 mr-2 rounded disabled:opacity-50 disabled:cursor-not-allowed ${
                  (post.status === "resolved" || post.status === "completed") && !isAdmin
                    ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                    : "bg-[#FD8E74] text-white hover:bg-[#c07c6d]"
                }`}
                title={
                  (post.status === "resolved" || post.status === "completed") && !isAdmin
                    ? "Cannot delete resolved or completed tickets"
                    : isDeleting
                    ? "Deleting ticket..."
                    : `Delete ticket "${post.title}" and ${post.images.length} associated image${post.images.length !== 1 ? "s" : ""}`
                }
              >
                {isDeleting ? "Deleting..." : "Delete Ticket"}
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="text-black lg:text-gray-600 lg:hover:text-black"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* Image Preview */}
        <div
          className="relative w-full flex flex-col justify-center items-center overflow-hidden"
          onClick={() => {
            if (!isEditing && previewImages.length > 1) {
              handleImageClick();
            } else if (isEditing) {
              setShowImgModal(true);
            }
          }}
        >
          {previewImages.length > 0 ? (
            <div className="flex items-center justify-center">
              <div className="relative group w-full max-w-md">
                <img
                  src={previewImages[currentImageIdx]}
                  className="w-full h-auto object-cover rounded cursor-pointer"
                  alt={`Image ${currentImageIdx + 1}`}
                  title="Click to view next image"
                />
                {showOverlay &&
                  previewImages.length > 1 &&
                  !hasUserInteracted &&
                  !isEditing && (
                    <div className="absolute inset-0 bg-black/45 flex items-center justify-center rounded animate-soft-blink">
                      <p className="text-white text-sm px-3 py-1">
                        Click to view more images
                      </p>
                    </div>
                  )}
                {/* Image Counter - shows current position and total images */}
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full">
                  {currentImageIdx + 1}/{previewImages.length}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-gray-400">No image uploaded</p>
          )}

          {isEditing && (
            <button className="text-sm bg-brand text-white w-full max-w-md my-3 p-2 rounded">
              Edit uploaded images
            </button>
          )}
        </div>

        {/* Found Action Badge - only show for found items */}
        {post.type === "found" && post.foundAction && (
          <div className="mt-4 flex justify-center">
            <span className="px-3 py-2 rounded-md font-medium bg-blue-100 text-blue-700 text-sm">
              {post.foundAction === "keep"
                ? "Keep"
                : post.foundAction === "turnover to OSA"
                ? "Turnover to OSA"
                : "Turnover to Campus Security"}
            </span>
          </div>
        )}

        {/* Info Section */}
        <div className="space-y-2 mt-5">
          {isEditing ? (
            <>
              <h1 className="text-sm">Information of an item</h1>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                {inputFields.map((field, idx) => (
                  <input
                    key={idx}
                    type={field.type}
                    value={field.value}
                    placeholder={field.placeholder}
                    onChange={field.onChange}
                    className="w-full border px-3 py-1 rounded"
                  />
                ))}

                {/* Admin-only fields */}
                {adminFields.map((field, idx) => (
                  <select
                    key={`admin-${idx}`}
                    value={field.value}
                    onChange={field.onChange}
                    className="w-full border px-3 py-1 rounded"
                  >
                    <option value="">{field.placeholder}</option>
                    {field.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ))}

                {/* Location Dropdown */}
                <div className="col-span-full">
                  <DropdownWithSearch
                    label="Last seen location"
                    data={locationOptions}
                    selected={editedLocation}
                    setSelected={setEditedLocation}
                    placeholder="Select a location"
                  />
                </div>

                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  className="w-full border px-3 py-1 rounded col-span-full"
                  placeholder="Description"
                />
              </div>
            </>
          ) : (
            <>
              <h1 className="text-base mt-5">Information of an item</h1>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <h1 className="text-sm mb-2">Title</h1>
                  <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2">
                    <p className="text-[12px]">{post.title}</p>
                  </div>
                  <h1 className="text-sm mb-2">Date and Time</h1>
                  <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2">
                    <p className="text-[12px]">
                      {post.createdAt
                        ? new Date(post.createdAt).toLocaleString()
                        : "Unknown"}
                    </p>
                  </div>
                  <h1 className="text-sm mb-2">Last seen location</h1>
                  <div className="bg-gray-100 p-2 rounded border border-gray-300 mb-3">
                    <p className="text-[12px] text-gray-700">{post.location}</p>
                  </div>

                  {/* Location Map */}
                  {post.coordinates && (
                    <div className="relative rounded-md overflow-hidden border border-gray-300 mb-3">
                      <LocationMap
                        coordinates={post.coordinates}
                        location={post.location}
                        className="h-[200px]"
                      />
                      {/* Coordinates overlay */}
                      <div className="absolute bottom-2 left-2 right-2 z-10 bg-white/90 backdrop-blur-sm rounded-md px-2 py-1 shadow-sm border border-gray-200 flex justify-center">
                        <span className="text-xs text-gray-600 font-mono">
                          {post.coordinates.lat.toFixed(6)},{" "}
                          {post.coordinates.lng.toFixed(6)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Pinned Coordinates */}
                  {post.coordinates && (
                    <div className="mb-3">
                      <p className="text-[12px] mb-1">Pinned Coordinates</p>
                      <div className="bg-gray-100 p-2 rounded border border-gray-300">
                        <p className="text-[12px] text-gray-700">
                          {post.coordinates.lat.toFixed(5)}{" "}
                          {post.coordinates.lng.toFixed(5)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <h1 className="text-sm mb-2">Description</h1>
                  <div className="bg-gray-100 p-2 lg:h-44 rounded border-gray-300">
                    <p className="text-[12px]">{post.description}</p>
                  </div>

                  {/* Turnover Details - only show when turnoverDetails exist */}
                  {post.turnoverDetails && (
                    <>
                      <h1 className="text-sm mt-3 mb-2">Turnover Details</h1>
                      <div className="bg-orange-50 p-3 rounded border border-orange-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-orange-800">Original Finder:</span>
                          <div className="flex items-center gap-2">
                            {post.turnoverDetails.originalFinder.profilePicture && (
                              <img
                                src={post.turnoverDetails.originalFinder.profilePicture}
                                alt={`${post.turnoverDetails.originalFinder.firstName} ${post.turnoverDetails.originalFinder.lastName}`}
                                className="w-8 h-8 rounded-full object-cover border-2 border-orange-200"
                              />
                            )}
                            <span className="text-sm text-orange-700">
                              {post.turnoverDetails.originalFinder.firstName} {post.turnoverDetails.originalFinder.lastName}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-orange-800">Student ID:</span>
                          <span className="text-sm text-orange-700">{post.turnoverDetails.originalFinder.studentId}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-orange-800">Action:</span>
                          <span className="text-sm text-orange-700 font-medium">
                            {post.turnoverDetails.turnoverAction === "turnover to OSA"
                              ? "Turned over to OSA"
                              : "Turned over to Campus Security"}
                          </span>
                        </div>
                        {post.turnoverDetails.turnoverAction !== "turnover to Campus Security" && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-orange-800">Decision Date:</span>
                            <span className="text-sm text-orange-700">
                              {post.turnoverDetails.turnoverDecisionAt
                                ? new Date(post.turnoverDetails.turnoverDecisionAt).toLocaleDateString()
                                : "Not specified"}
                            </span>
                          </div>
                        )}
                        {post.turnoverDetails.turnoverReason && (
                          <div className="mt-2">
                            <span className="text-sm font-medium text-orange-800 block">Reason:</span>
                            <p className="text-sm text-orange-700 bg-orange-100 p-2 rounded mt-1">
                              {post.turnoverDetails.turnoverReason}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-orange-800">Status:</span>
                          <span className={`text-sm px-2 py-1 rounded-full ${
                            post.turnoverDetails.turnoverStatus === "declared"
                              ? "bg-blue-100 text-blue-800"
                              : post.turnoverDetails.turnoverStatus === "confirmed"
                              ? "bg-green-100 text-green-800"
                              : post.turnoverDetails.turnoverStatus === "not_received"
                              ? "bg-red-100 text-red-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            {post.turnoverDetails.turnoverStatus === "declared"
                              ? "Declared for Turnover"
                              : post.turnoverDetails.turnoverStatus === "confirmed"
                              ? "Confirmed by OSA"
                              : post.turnoverDetails.turnoverStatus === "not_received"
                              ? "Not Received"
                              : "Transferred"}
                          </span>
                        </div>
                        {post.turnoverDetails.confirmedAt && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-orange-800">Confirmed Date:</span>
                            <span className="text-sm text-orange-700">
                              {new Date(post.turnoverDetails.confirmedAt).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {post.turnoverDetails.confirmationNotes && (
                          <div className="mt-2">
                            <span className="text-sm font-medium text-orange-800 block">Confirmation Notes:</span>
                            <p className="text-sm text-orange-700 bg-orange-100 p-2 rounded mt-1">
                              {post.turnoverDetails.confirmationNotes}
                            </p>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
              <h1 className="text-sm mt-7">Contact Details</h1>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <h1 className="text-sm mb-2">Name</h1>
                  <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2">
                    <p className="text-[12px]">
                      {post.user?.firstName ?? ""} {post.user?.lastName ?? ""}
                    </p>
                  </div>
                  <h1 className="text-sm mb-2">Email</h1>
                  <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2">
                    <p className="text-[12px]">{post.user?.email}</p>
                  </div>
                  <h1 className="text-sm mb-2">Contact Number</h1>
                  <div className="bg-gray-50 border border-gray-400 rounded py-2 px-2">
                    <p className="text-[12px]">{post.user?.contactNum}</p>
                  </div>
                </div>
                <div>
                  <h1 className="text-sm mb-2">Ticket Status</h1>
                  <div className="flex items-center">
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        getStatusStyles(post.status).bgColor
                      } ${getStatusStyles(post.status).textColor} ${
                        getStatusStyles(post.status).borderColor
                      } border`}
                    >
                      {getStatusStyles(post.status).displayText}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Image Overlay */}
      {showImgOverlay && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => {
            handleNextImage();
            setHasUserInteracted(true);
            lastInteractionTimeRef.current = Date.now();
          }}
        >
          <div className="relative max-w-3xl w-full p-6">
            <img
              src={previewImages[currentImageIdx]}
              alt="Overlay View"
              className="max-h-[90vh] mx-auto object-contain rounded"
            />
            <p className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded text-sm">
              Click image to view next
            </p>
            <button
              className="absolute top-4 right-6 text-white text-xl"
              onClick={(e) => {
                e.stopPropagation();
                setShowImgOverlay(false);
              }}
            >
              <FiX />
            </button>
          </div>
        </div>
      )}

      {/* Edit Image Modal */}
      {isEditing && showImgModal && (
        <div
          className="fixed inset-0 bg-black/20 z-50 flex justify-center items-center"
          onClick={() => setShowImgModal(false)}
        >
          <div
            className="bg-white rounded p-4 max-w-2xl w-11/12 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-center text-lg font-semibold mb-2">
              Edit Uploaded Images
            </h2>
            {/* Image Counter for editing modal */}
            <div className="text-center text-sm text-gray-600 mb-4">
              {editedImages.length}/3 photos selected
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {previewImages.map((img, idx) => (
                <div key={idx} className="relative">
                  <img
                    src={img}
                    alt={`Uploaded ${idx}`}
                    className="w-full h-auto object-cover rounded cursor-pointer"
                  />
                  <button
                    className={`absolute top-1 right-1 p-1 rounded transition-all ${
                      editedImages.length <= 1
                        ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                        : "bg-red-600 text-white hover:bg-red-500 cursor-pointer"
                    }`}
                    onClick={() => handleDeleteImage(idx)}
                    disabled={editedImages.length <= 1}
                    title={
                      editedImages.length <= 1
                        ? "Posts must have at least one image"
                        : "Delete image"
                    }
                  >
                    <FiX size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Helpful message when only one image remains */}
            {editedImages.length <= 1 && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 text-sm">ℹ️</span>
                  <span className="text-blue-700 text-sm font-medium">
                    Posts must have at least one image. To replace this image,
                    upload a new one first.
                  </span>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-center">
              {/* Hidden file input */}
              <input
                id="upload-input"
                type="file"
                accept="image/*"
                multiple
                onChange={handleUploadMore}
                className="hidden"
              />

              {/* Custom button */}
              <label
                htmlFor="upload-input"
                className="flex items-center justify-center px-4 py-2 border border-navyblue text-navyblue text-sm w-full rounded-sm cursor-pointer hover:border-blue-900 hover:text-blue-900 transition-colors"
              >
                Add an image
              </label>
            </div>

            <div className="flex justify-end mt-4">
              <button
                className="p-2 w-full bg-green-600 text-white rounded-sm hover:bg-green-500"
                onClick={handleSaveImages}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketModal;
