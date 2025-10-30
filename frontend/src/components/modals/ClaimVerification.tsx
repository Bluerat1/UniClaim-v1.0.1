import React, { useState } from "react";
import { useToast } from "@/context/ToastContext";

interface ClaimVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    claimReason: string,
    idPhotoFile: File | null,
    evidencePhotos: File[]
  ) => void;
  itemTitle: string;
  itemDescription?: string;
  isLoading?: boolean;
  onSuccess?: () => void; // New prop to handle successful submission
}

const ClaimVerificationModal: React.FC<ClaimVerificationModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  itemTitle,
  itemDescription,
  isLoading = false,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const [claimReason, setClaimReason] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [idPhotoFile, setIdPhotoFile] = useState<File | null>(null);
  const [idPhotoPreview, setIdPhotoPreview] = useState<string | null>(null);
  const [evidencePhotos, setEvidencePhotos] = useState<File[]>([]);
  const [evidencePhotoPreviews, setEvidencePhotoPreviews] = useState<string[]>(
    []
  );

  // Function to clear all form entries
  const clearForm = () => {
    setClaimReason("");
    setIsConfirmed(false);
    setIdPhotoFile(null);
    setIdPhotoPreview(null);
    setEvidencePhotos([]);
    setEvidencePhotoPreviews([]);

    // Reset file inputs
    const idPhotoInput = document.getElementById(
      "idPhotoInput"
    ) as HTMLInputElement;
    const evidencePhotosInput = document.getElementById(
      "evidencePhotosInput"
    ) as HTMLInputElement;
    const additionalEvidencePhotosInput = document.getElementById(
      "additionalEvidencePhotosInput"
    ) as HTMLInputElement;

    if (idPhotoInput) idPhotoInput.value = "";
    if (evidencePhotosInput) evidencePhotosInput.value = "";
    if (additionalEvidencePhotosInput) additionalEvidencePhotosInput.value = "";
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        showToast(
          'error',
          "File size must be less than 5MB. Please choose a smaller image."
        );
        return;
      }

      setIdPhotoFile(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setIdPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      alert("Please select a valid image file (JPEG, PNG, etc.)");
    }
  };

  const removePhoto = () => {
    setIdPhotoFile(null);
    setIdPhotoPreview(null);
    // Reset the file input
    const fileInput = document.getElementById(
      "idPhotoInput"
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleEvidencePhotoSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (files) {
      const newPhotos: File[] = [];
      const newPreviews: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file && file.type.startsWith("image/")) {
          // Validate file size (max 5MB)
          if (file.size > 5 * 1024 * 1024) {
            alert(
              `File ${file.name} is too large. Please choose a file smaller than 5MB.`
            );
            continue;
          }

          // Check if we already have 3 photos
          if (evidencePhotos.length + newPhotos.length >= 3) {
            alert(
              "Maximum 3 evidence photos allowed. Please remove some photos first."
            );
            break;
          }

          newPhotos.push(file);

          // Create preview URL
          const reader = new FileReader();
          reader.onload = (e) => {
            newPreviews.push(e.target?.result as string);
            setEvidencePhotoPreviews([
              ...evidencePhotoPreviews,
              ...newPreviews,
            ]);
          };
          reader.readAsDataURL(file);
        } else {
          alert(
            `File ${file.name} is not a valid image file. Please select JPEG, PNG, etc.`
          );
        }
      }

      setEvidencePhotos([...evidencePhotos, ...newPhotos]);
    }
  };

  const removeEvidencePhoto = (index: number) => {
    const newPhotos = evidencePhotos.filter((_, i) => i !== index);
    const newPreviews = evidencePhotoPreviews.filter((_, i) => i !== index);
    setEvidencePhotos(newPhotos);
    setEvidencePhotoPreviews(newPreviews);
  };

  const removeAllEvidencePhotos = () => {
    setEvidencePhotos([]);
    setEvidencePhotoPreviews([]);
    // Reset the file input
    const fileInput = document.getElementById(
      "evidencePhotosInput"
    ) as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isConfirmed && idPhotoFile && evidencePhotos.length > 0) {
      // Clear the form immediately after submission
      clearForm();
      // Call the onSubmit function
      onSubmit(claimReason, idPhotoFile, evidencePhotos);
      // Call onSuccess if provided
      if (onSuccess) {
        onSuccess();
      }
    }
  };

  const handleClose = () => {
    clearForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex max-h-xl items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white rounded-lg shadow-xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              Verify Claim Request
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Please provide your ID photo and confirm the details before
              claiming this item
            </p>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="px-6 py-4">
            {/* Item Details */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Item Details
              </label>
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="font-medium text-gray-900">{itemTitle}</h4>
                {itemDescription && (
                  <p className="text-sm text-gray-600 mt-1">
                    {itemDescription}
                  </p>
                )}
              </div>
            </div>

            {/* ID Photo Upload - REQUIRED */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ID Photo <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Please upload a clear photo of your ID (Student ID, Driver's
                License, etc.) as proof of identity
              </p>

              {!idPhotoFile ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                  <input
                    id="idPhotoInput"
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    required
                  />
                  <label htmlFor="idPhotoInput" className="cursor-pointer">
                    <div className="text-gray-600">
                      <div className="text-2xl mb-2">📷</div>
                      <div className="font-medium">
                        Click to upload ID photo
                      </div>
                      <div className="text-sm">JPEG, PNG up to 5MB</div>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="border border-gray-300 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Selected ID Photo:
                    </span>
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>

                  {/* Photo Preview */}
                  <div className="mb-2">
                    {idPhotoPreview && (
                      <img
                        src={idPhotoPreview}
                        alt="ID Photo Preview"
                        className="w-full h-32 object-cover rounded border"
                      />
                    )}
                  </div>

                  <div className="text-xs text-gray-600">
                    <div>Size: {(idPhotoFile.size / 1024).toFixed(1)} KB</div>
                  </div>
                </div>
              )}
            </div>

            {/* Evidence Photos Upload - REQUIRED */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Evidence Photos <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Please upload up to 3 photos as proof of ownership (e.g., you
                with the item, item details, etc.)
              </p>

              {evidencePhotos.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                  <input
                    id="evidencePhotosInput"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleEvidencePhotoSelect}
                    className="hidden"
                    required
                  />
                  <label
                    htmlFor="evidencePhotosInput"
                    className="cursor-pointer"
                  >
                    <div className="text-gray-600">
                      <div className="text-2xl mb-2">📸</div>
                      <div className="font-medium">
                        Click to upload evidence photos
                      </div>
                      <div className="text-sm">
                        JPEG, PNG up to 5MB each (Max 3 photos)
                      </div>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Photo Counter and Remove All Button */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {evidencePhotos.length}/3 photos selected
                    </span>
                    {evidencePhotos.length > 0 && (
                      <button
                        type="button"
                        onClick={removeAllEvidencePhotos}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove All
                      </button>
                    )}
                  </div>

                  {/* Photo Grid */}
                  <div className="grid grid-cols-1 gap-3">
                    {evidencePhotos.map((photo, index) => (
                      <div
                        key={index}
                        className="border border-gray-300 rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">
                            Evidence Photo {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeEvidencePhoto(index)}
                            className="text-red-500 hover:text-red-700 text-sm"
                          >
                            Remove
                          </button>
                        </div>

                        {/* Photo Preview */}
                        <div className="mb-2">
                          {evidencePhotoPreviews[index] && (
                            <img
                              src={evidencePhotoPreviews[index]}
                              alt={`Evidence Photo ${index + 1}`}
                              className="w-full h-32 object-cover rounded border"
                            />
                          )}
                        </div>

                        <div className="text-xs text-gray-600">
                          <div>Size: {(photo.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add More Photos Button */}
                  {evidencePhotos.length < 3 && (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-blue-400 transition-colors">
                      <input
                        id="additionalEvidencePhotosInput"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleEvidencePhotoSelect}
                        className="hidden"
                      />
                      <label
                        htmlFor="additionalEvidencePhotosInput"
                        className="cursor-pointer"
                      >
                        <div className="text-gray-600">
                          <div className="text-sm font-medium">
                            Add more evidence photos
                          </div>
                          <div className="text-xs">
                            You can add {3 - evidencePhotos.length} more
                            photo(s)
                          </div>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Claim Reason */}
            <div className="mb-4">
              <label
                htmlFor="claimReason"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Why do you want to claim this item? (Optional)
              </label>
              <textarea
                id="claimReason"
                value={claimReason}
                onChange={(e) => setClaimReason(e.target.value)}
                placeholder="Briefly explain why you're claiming this item..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={3}
                maxLength={200}
              />
              <p className="text-xs text-gray-500 mt-1">
                {claimReason.length}/200 characters
              </p>
            </div>

            {/* Confirmation Checkbox */}
            <div className="mb-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  required
                />
                <span className="ml-2 text-sm text-gray-700">
                  I confirm that I want to claim this item and understand this
                  is a claim request
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  !isConfirmed ||
                  !idPhotoFile ||
                  evidencePhotos.length === 0 ||
                  isLoading
                }
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Sending...
                  </div>
                ) : (
                  "Send Claim Request"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ClaimVerificationModal;
